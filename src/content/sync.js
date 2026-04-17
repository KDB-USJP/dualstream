/**
 * DualStream — Sync Conductor
 * 
 * The core sync engine that coordinates playback between the YouTube
 * video element and the alternate audio source (Mixcloud or generic).
 * 
 * Uses a requestAnimationFrame-based drift correction loop with an
 * accumulator to check drift every ~200ms.
 */

const DSSyncConductor = {
  _video: null,
  _audioAdapter: null,
  _running: false,
  _rafId: null,
  _lastCheckTime: 0,
  _userOffset: 0,         // User-defined offset in seconds
  _currentDrift: 0,       // Last measured drift in ms
  _syncState: DS_CONSTANTS.SYNC_IDLE,
  _driftCallbacks: [],
  _stateCallbacks: [],
  _correctionFrames: 0,   // Frames remaining for gentle rate correction
  _settings: null,
  _boundHandlers: {},
  _suppressEvents: false,  // Prevents feedback loop between video↔audio event handlers

  /**
   * Initialize the sync conductor.
   * @param {HTMLVideoElement} video - The YT video element
   * @param {object} audioAdapter - DSMixcloudPlayer or DSGenericPlayer
   * @param {object} [settings] - User settings
   */
  async init(video, audioAdapter, settings = {}) {
    this._video = video;
    this._audioAdapter = audioAdapter;
    this._settings = { ...DS_CONSTANTS.DEFAULT_SETTINGS, ...settings };
    this._userOffset = (this._settings.userOffset || 0) / 1000; // Convert ms to seconds

    // Set YT video volume to near-silent
    this._video.volume = Math.max(0.01, (this._settings.ytVolume || 1) / 100);

    // Bind event handlers (so we can remove them later)
    this._boundHandlers = {
      onPlay: this._onVideoPlay.bind(this),
      onPause: this._onVideoPause.bind(this),
      onSeeked: this._onVideoSeeked.bind(this),
      onRateChange: this._onVideoRateChange.bind(this),
    };

    this._setupVideoListeners();
    this._setupAudioListeners();
    this._setState(DS_CONSTANTS.SYNC_LOADING);

    DS_UTILS.log('Sync conductor initialized');
  },

  /**
   * Start linked playback.
   * Pauses the YT video, seeks the audio to match, then starts both.
   * @returns {Promise<void>}
   */
  async start() {
    if (!this._video || !this._audioAdapter) {
      DS_UTILS.error('Sync conductor: not initialized');
      return;
    }

    try {
      this._setState(DS_CONSTANTS.SYNC_BUFFERING);

      // Get the current video position
      const videoTime = this._video.currentTime;

      // Seek audio to match (with user offset)
      const targetTime = Math.max(0, videoTime + this._userOffset);
      await this._audioAdapter.seek(targetTime);

      // Small delay to let the audio buffer after seeking
      await this._delay(200);

      // Start the audio
      await this._audioAdapter.play();

      // If video was paused, play it too
      if (this._video.paused) {
        await this._video.play();
      }

      // Start the drift correction loop
      this._running = true;
      this._lastCheckTime = performance.now();
      this._driftLoop();

      this._setState(DS_CONSTANTS.SYNC_SYNCING);
      DS_UTILS.log('Sync started at video time:', videoTime);
    } catch (e) {
      DS_UTILS.error('Sync start failed:', e);
      this._setState(DS_CONSTANTS.SYNC_ERROR);
    }
  },

  /**
   * Stop linked playback.
   */
  async stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Pause the audio (leave video playing)
    try {
      await this._audioAdapter.pause();
    } catch (e) {
      // Ignore errors during stop
    }

    // Restore video volume
    if (this._video) {
      this._video.volume = 1.0;
    }

    this._setState(DS_CONSTANTS.SYNC_IDLE);
    DS_UTILS.log('Sync stopped');
  },

  /**
   * Force a hard re-sync.
   * @returns {Promise<void>}
   */
  async resync() {
    if (!this._running) return;

    DS_UTILS.log('Manual resync triggered');
    this._setState(DS_CONSTANTS.SYNC_BUFFERING);

    const videoTime = this._video.currentTime;
    const targetTime = Math.max(0, videoTime + this._userOffset);

    await this._audioAdapter.seek(targetTime);
    await this._delay(150);

    this._setState(DS_CONSTANTS.SYNC_SYNCING);
  },

  /**
   * Update the user offset (in milliseconds).
   * @param {number} offsetMs - Offset in milliseconds
   */
  setUserOffset(offsetMs) {
    this._userOffset = offsetMs / 1000;
    DS_UTILS.log('User offset set to', offsetMs, 'ms');
  },

  /**
   * Update the YT volume.
   * @param {number} volumePercent - 0-100
   */
  setYtVolume(volumePercent) {
    if (this._video) {
      this._video.volume = Math.max(0.01, volumePercent / 100);
    }
  },

  /**
   * Get the current drift in milliseconds.
   * @returns {number}
   */
  getCurrentDrift() {
    return this._currentDrift;
  },

  /**
   * Get the current sync state.
   * @returns {string}
   */
  getState() {
    return this._syncState;
  },

  /**
   * Register a callback for drift updates.
   * @param {Function} callback - Receives (driftMs, state)
   */
  onDrift(callback) {
    this._driftCallbacks.push(callback);
  },

  /**
   * Register a callback for state changes.
   * @param {Function} callback - Receives (state)
   */
  onStateChange(callback) {
    this._stateCallbacks.push(callback);
  },

  // ─── Private Methods ───────────────────────────────────────

  /**
   * The main drift correction loop, driven by requestAnimationFrame.
   * Checks drift every CORRECTION_CHECK_MS.
   */
  _driftLoop() {
    if (!this._running) return;

    this._rafId = requestAnimationFrame(() => {
      const now = performance.now();
      const elapsed = now - this._lastCheckTime;

      if (elapsed >= DS_CONSTANTS.CORRECTION_CHECK_MS) {
        this._lastCheckTime = now;
        this._checkAndCorrectDrift();
      }

      // Continue the loop
      this._driftLoop();
    });
  },

  /**
   * Check the drift between video and audio, and apply corrections.
   */
  async _checkAndCorrectDrift() {
    if (!this._video || !this._audioAdapter) return;
    if (this._video.paused) return; // Don't correct while paused

    try {
      // Get positions
      const videoTime = this._video.currentTime;
      const audioTime = this._audioAdapter.getPosition(false); // Fast cached read

      // Handle async result from Mixcloud
      const resolvedAudioTime = audioTime instanceof Promise ? await audioTime : audioTime;

      // Calculate drift (positive = audio is behind, negative = audio is ahead)
      const drift = (videoTime + this._userOffset - resolvedAudioTime) * 1000; // Convert to ms
      this._currentDrift = drift;
      const absDrift = Math.abs(drift);

      // Notify listeners
      this._driftCallbacks.forEach((cb) => cb(drift, this._syncState));

      // Apply correction strategy
      if (absDrift <= DS_CONSTANTS.DRIFT_OK) {
        // Perfect — ensure normal playback rate
        if (this._correctionFrames > 0) {
          this._audioAdapter.setPlaybackRate(DS_CONSTANTS.RATE_NORMAL);
          this._correctionFrames = 0;
        }
      } else if (absDrift <= DS_CONSTANTS.DRIFT_WARN) {
        // Gentle correction via playback rate adjustment
        if (this._audioAdapter.supportsPlaybackRate()) {
          const rate = drift > 0 ? DS_CONSTANTS.RATE_BOOST : DS_CONSTANTS.RATE_SLOW;
          this._audioAdapter.setPlaybackRate(rate);
          this._correctionFrames = 10; // Correct for ~10 check cycles
        } else {
          // Mixcloud: can't adjust rate, do a micro-seek if drift > 50ms
          if (absDrift > 50) {
            const targetTime = videoTime + this._userOffset;
            this._audioAdapter.seek(targetTime);
          }
        }
      } else if (absDrift > DS_CONSTANTS.DRIFT_CRITICAL) {
        // Major drift — likely a user seek on YT. Hard resync.
        DS_UTILS.log('Critical drift detected:', drift, 'ms — hard resync');
        const targetTime = Math.max(0, videoTime + this._userOffset);
        await this._audioAdapter.seek(targetTime);
        this._audioAdapter.setPlaybackRate(DS_CONSTANTS.RATE_NORMAL);
        this._correctionFrames = 0;
      } else {
        // Moderate drift (100ms - 2000ms) — seek to correct
        const targetTime = Math.max(0, videoTime + this._userOffset);
        await this._audioAdapter.seek(targetTime);
        this._audioAdapter.setPlaybackRate(DS_CONSTANTS.RATE_NORMAL);
        this._correctionFrames = 0;
      }

      // Decrement correction frame counter
      if (this._correctionFrames > 0) {
        this._correctionFrames--;
        if (this._correctionFrames === 0) {
          this._audioAdapter.setPlaybackRate(DS_CONSTANTS.RATE_NORMAL);
        }
      }
    } catch (e) {
      DS_UTILS.warn('Drift check error:', e);
    }
  },

  /**
   * Set up event listeners on the YT video element.
   */
  _setupVideoListeners() {
    this._video.addEventListener('play', this._boundHandlers.onPlay);
    this._video.addEventListener('pause', this._boundHandlers.onPause);
    this._video.addEventListener('seeked', this._boundHandlers.onSeeked);
    this._video.addEventListener('ratechange', this._boundHandlers.onRateChange);
  },

  /**
   * Set up listeners on the audio adapter for reverse controls
   * (pausing Mixcloud pauses YT video, and vice versa).
   */
  _setupAudioListeners() {
    if (!this._audioAdapter || !this._audioAdapter.onStateChange) return;

    this._audioAdapter.onStateChange((state) => {
      if (!this._running || this._suppressEvents) return;

      if (state === 'pause') {
        // Reverse pause: Mixcloud paused → pause YT video
        if (this._video && !this._video.paused) {
          DS_UTILS.log('Audio paused — pausing video to match');
          this._suppressEvents = true;
          this._video.pause();
          setTimeout(() => { this._suppressEvents = false; }, 100);
        }
      } else if (state === 'play') {
        // Reverse play: Mixcloud resumed → resume YT video
        if (this._video && this._video.paused) {
          DS_UTILS.log('Audio resumed — resuming video to match');
          this._suppressEvents = true;
          this._video.play().catch(() => {});
          setTimeout(() => { this._suppressEvents = false; }, 100);
        }
      }
    });
  },

  /**
   * Handle video play event.
   */
  async _onVideoPlay() {
    if (!this._running || this._suppressEvents) return;
    DS_UTILS.log('Video play detected');
    try {
      this._suppressEvents = true;
      await this._audioAdapter.play();
      this._suppressEvents = false;
      this._setState(DS_CONSTANTS.SYNC_SYNCING);
    } catch (e) {
      this._suppressEvents = false;
      DS_UTILS.warn('Failed to sync play:', e);
    }
  },

  /**
   * Handle video pause event.
   */
  async _onVideoPause() {
    if (!this._running || this._suppressEvents) return;
    DS_UTILS.log('Video pause detected');
    try {
      this._suppressEvents = true;
      await this._audioAdapter.pause();
      this._suppressEvents = false;
      this._setState(DS_CONSTANTS.SYNC_PAUSED);
    } catch (e) {
      this._suppressEvents = false;
      DS_UTILS.warn('Failed to sync pause:', e);
    }
  },

  /**
   * Handle video seek event.
   */
  async _onVideoSeeked() {
    if (!this._running) return;
    const videoTime = this._video.currentTime;
    DS_UTILS.log('Video seeked to', videoTime);

    const targetTime = Math.max(0, videoTime + this._userOffset);
    try {
      await this._audioAdapter.seek(targetTime);
    } catch (e) {
      DS_UTILS.warn('Failed to sync seek:', e);
    }
  },

  /**
   * Handle video playback rate change.
   */
  _onVideoRateChange() {
    if (!this._running) return;
    const rate = this._video.playbackRate;
    DS_UTILS.log('Video rate changed to', rate);

    // Only propagate if the adapter supports it
    if (this._audioAdapter.supportsPlaybackRate()) {
      this._audioAdapter.setPlaybackRate(rate);
    }
  },

  /**
   * Set the sync state and notify listeners.
   * @param {string} state
   */
  _setState(state) {
    if (this._syncState === state) return;
    this._syncState = state;
    this._stateCallbacks.forEach((cb) => cb(state));

    // Notify background service worker
    try {
      chrome.runtime.sendMessage({
        type: DS_CONSTANTS.MSG_SYNC_STATUS,
        state,
        drift: this._currentDrift,
      });
    } catch {
      // Extension context may not be available
    }
  },

  /**
   * Utility delay.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Remove video event listeners.
   */
  _removeVideoListeners() {
    if (!this._video) return;
    this._video.removeEventListener('play', this._boundHandlers.onPlay);
    this._video.removeEventListener('pause', this._boundHandlers.onPause);
    this._video.removeEventListener('seeked', this._boundHandlers.onSeeked);
    this._video.removeEventListener('ratechange', this._boundHandlers.onRateChange);
  },

  /**
   * Destroy the sync conductor and clean up.
   * Handles cleanup synchronously to avoid race conditions with async stop().
   */
  destroy() {
    // Stop the drift correction loop immediately
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Pause audio (fire-and-forget, it's OK if this fails)
    if (this._audioAdapter) {
      try { this._audioAdapter.pause(); } catch {};
    }

    // Restore video volume
    if (this._video) {
      try { this._video.volume = 1.0; } catch {};
    }

    // Remove listeners before nulling references
    this._removeVideoListeners();

    this._video = null;
    this._audioAdapter = null;
    this._driftCallbacks = [];
    this._stateCallbacks = [];
    this._boundHandlers = {};
    this._currentDrift = 0;
    this._userOffset = 0;
    this._suppressEvents = false;
    this._syncState = DS_CONSTANTS.SYNC_IDLE;
    DS_UTILS.log('Sync conductor destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.DSSyncConductor = DSSyncConductor;
}
