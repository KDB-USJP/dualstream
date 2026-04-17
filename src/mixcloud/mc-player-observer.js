/**
 * DualStream — Mixcloud Page Player Observer
 *
 * Reads the state of Mixcloud's native page-level audio player by observing
 * the DOM (time display text, play/pause button state).
 *
 * Strategy: DOM polling + MutationObserver hybrid.
 * - Polls the bottom bar time text every ~200ms
 * - Watches play/pause button for attribute/class changes
 * - Falls back to scanning for <audio> elements in the DOM
 */

const MCPlayerObserver = {
  _polling: false,
  _pollInterval: null,
  _position: 0,
  _duration: 0,
  _paused: true,
  _progressCallbacks: [],
  _stateCallbacks: [],
  _lastPausedState: true,
  _audioElement: null,
  _mutationObserver: null,

  /**
   * Start observing the Mixcloud player.
   */
  init() {
    DS_UTILS.log('MC Player Observer: initializing');

    // Try to find a hidden <audio> element first (most reliable)
    this._findAudioElement();

    // Start polling the DOM for time/state
    this._startPolling();

    // Watch for play/pause button changes
    this._watchPlayButton();

    DS_UTILS.log('MC Player Observer: ready');
  },

  /**
   * Try to find a native <audio> element in the Mixcloud page DOM.
   * If found, we can read currentTime/duration directly — much more reliable.
   */
  _findAudioElement() {
    const audios = document.querySelectorAll('audio');
    if (audios.length > 0) {
      this._audioElement = audios[0];
      DS_UTILS.log('MC Player Observer: found <audio> element!', this._audioElement.src);

      // Listen for events on the audio element
      this._audioElement.addEventListener('timeupdate', () => {
        this._position = this._audioElement.currentTime;
        this._duration = this._audioElement.duration || 0;
        this._progressCallbacks.forEach((cb) => cb(this._position, this._duration));
      });

      this._audioElement.addEventListener('play', () => {
        this._setPausedState(false);
      });

      this._audioElement.addEventListener('pause', () => {
        this._setPausedState(true);
      });

      return;
    }

    // If no audio element, set up a MutationObserver to watch for one
    const bodyObserver = new MutationObserver(() => {
      const newAudios = document.querySelectorAll('audio');
      if (newAudios.length > 0 && !this._audioElement) {
        this._audioElement = newAudios[0];
        DS_UTILS.log('MC Player Observer: <audio> element appeared!');

        this._audioElement.addEventListener('timeupdate', () => {
          this._position = this._audioElement.currentTime;
          this._duration = this._audioElement.duration || 0;
          this._progressCallbacks.forEach((cb) => cb(this._position, this._duration));
        });

        this._audioElement.addEventListener('play', () => {
          this._setPausedState(false);
        });

        this._audioElement.addEventListener('pause', () => {
          this._setPausedState(true);
        });
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    this._mutationObserver = bodyObserver;
  },

  /**
   * Start polling the bottom player bar for time display text.
   */
  _startPolling() {
    if (this._polling) return;
    this._polling = true;

    this._pollInterval = setInterval(() => {
      // If we have a direct audio element, use it (more reliable)
      if (this._audioElement) {
        this._position = this._audioElement.currentTime || 0;
        this._duration = this._audioElement.duration || 0;
        const wasPaused = this._paused;
        this._paused = this._audioElement.paused;
        if (wasPaused !== this._paused) {
          this._stateCallbacks.forEach((cb) => cb(this._paused ? 'pause' : 'play'));
        }
        return;
      }

      // Fallback: read the time display text from the bottom bar
      this._readTimeFromDOM();
      this._readPlayStateFromDOM();
    }, 200);
  },

  /**
   * Read the time display from the bottom player bar.
   * Expects format like "00:15 / 02:50" or "1:23:45 / 2:00:00"
   */
  _readTimeFromDOM() {
    // Find the bottom player bar
    const playerBar = this._findBottomBar();
    if (!playerBar) return;

    // Get ALL text content from the bar and look for time patterns
    const text = playerBar.textContent || '';

    // Match time patterns: "MM:SS / MM:SS" or "H:MM:SS / H:MM:SS"
    const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/;
    const match = text.match(timePattern);

    if (match) {
      const pos = this._parseTimeString(match[1]);
      const dur = this._parseTimeString(match[2]);
      if (pos !== this._position || dur !== this._duration) {
        this._position = pos;
        this._duration = dur;
        this._progressCallbacks.forEach((cb) => cb(pos, dur));
      }
    }
  },

  /**
   * Read play/pause state from the DOM button.
   */
  _readPlayStateFromDOM() {
    const playBtn = this._findPlayButton();
    if (!playBtn) return;

    // Check the button's aria-label, or look for pause icon vs play icon
    const label = playBtn.getAttribute('aria-label') || '';
    const isPaused = label.toLowerCase().includes('play') ||
                     !label.toLowerCase().includes('pause');

    // Also check SVG path data — pause icon is two bars, play is a triangle
    const svg = playBtn.querySelector('svg');
    if (svg) {
      const paths = svg.querySelectorAll('path');
      // Pause icon typically has 2 rect-like paths
      // Play icon has a single triangle path
      if (paths.length === 1) {
        // Likely a play triangle
        this._setPausedState(true);
        return;
      } else if (paths.length >= 2) {
        this._setPausedState(false);
        return;
      }
    }

    this._setPausedState(isPaused);
  },

  /**
   * Watch the play/pause button for changes via MutationObserver.
   */
  _watchPlayButton() {
    // We'll re-find the button periodically since it might not exist yet
    const findAndWatch = () => {
      const playBtn = this._findPlayButton();
      if (!playBtn) {
        setTimeout(findAndWatch, 1000);
        return;
      }

      const observer = new MutationObserver(() => {
        this._readPlayStateFromDOM();
      });

      observer.observe(playBtn, {
        attributes: true,
        attributeFilter: ['aria-label', 'class', 'data-state'],
        childList: true,
        subtree: true,
      });
    };

    setTimeout(findAndWatch, 1000);
  },

  /**
   * Find the bottom player bar element.
   */
  _findBottomBar() {
    // Try each selector
    for (const sel of DS_CONSTANTS.MC_PLAYER_BAR_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: find the fixed-position bar at the bottom
    const bars = document.querySelectorAll('[style*="position: fixed"]');
    for (const bar of bars) {
      if (bar.textContent && bar.textContent.match(/\d+:\d+\s*\/\s*\d+:\d+/)) {
        return bar;
      }
    }

    // Another fallback: search for the time pattern in any element near bottom of page
    const allElements = document.querySelectorAll('*');
    for (let i = allElements.length - 1; i >= Math.max(0, allElements.length - 50); i--) {
      const el = allElements[i];
      const rect = el.getBoundingClientRect();
      if (rect.bottom >= window.innerHeight - 80 && rect.height < 100) {
        const text = el.textContent || '';
        if (text.match(/\d+:\d+\s*\/\s*\d+:\d+/)) {
          return el;
        }
      }
    }

    return null;
  },

  /**
   * Find the play/pause button.
   */
  _findPlayButton() {
    for (const sel of DS_CONSTANTS.MC_PLAY_BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: find button in the bottom bar containing play/pause SVG
    const bar = this._findBottomBar();
    if (bar) {
      const buttons = bar.querySelectorAll('button');
      for (const btn of buttons) {
        const svg = btn.querySelector('svg');
        if (svg) return btn;
      }
    }

    return null;
  },

  /**
   * Parse a time string like "1:23" or "1:23:45" into seconds.
   * @param {string} timeStr
   * @returns {number}
   */
  _parseTimeString(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  },

  /**
   * Set paused state and notify callbacks if changed.
   */
  _setPausedState(paused) {
    if (this._lastPausedState !== paused) {
      this._lastPausedState = paused;
      this._paused = paused;
      DS_UTILS.log('MC Player:', paused ? 'paused' : 'playing');
      this._stateCallbacks.forEach((cb) => cb(paused ? 'pause' : 'play'));
    }
  },

  // ─── Public API ───────────────────────────────────────────

  /**
   * Get current position in seconds.
   * @returns {number}
   */
  getPosition() {
    if (this._audioElement) {
      return this._audioElement.currentTime || 0;
    }
    return this._position;
  },

  /**
   * Get total duration in seconds.
   * @returns {number}
   */
  getDuration() {
    if (this._audioElement) {
      return this._audioElement.duration || 0;
    }
    return this._duration;
  },

  /**
   * Check if the player is paused.
   * @returns {boolean}
   */
  isPaused() {
    if (this._audioElement) {
      return this._audioElement.paused;
    }
    return this._paused;
  },

  /**
   * Register a callback for progress updates.
   * @param {Function} callback - Receives (position, duration)
   */
  onProgress(callback) {
    this._progressCallbacks.push(callback);
  },

  /**
   * Register a callback for state changes.
   * @param {Function} callback - Receives 'play' or 'pause'
   */
  onStateChange(callback) {
    this._stateCallbacks.push(callback);
  },

  /**
   * Destroy the observer and clean up.
   */
  destroy() {
    this._polling = false;
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    this._audioElement = null;
    this._progressCallbacks = [];
    this._stateCallbacks = [];
    DS_UTILS.log('MC Player Observer: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.MCPlayerObserver = MCPlayerObserver;
}
