/**
 * DualStream — Reverse Sync Conductor (Mixcloud → YouTube)
 *
 * Links Mixcloud native player (audio, primary) with a YouTube embed
 * (video, secondary, muted). Monitors Mixcloud position via MCPlayerObserver
 * and corrects the YouTube embed to stay aligned.
 */

const MCSyncConductor = {
  _observer: null,     // MCPlayerObserver
  _embed: null,        // MCYouTubeEmbed
  _running: false,
  _rafId: null,
  _lastCheckTime: 0,
  _currentDrift: 0,
  _syncState: DS_CONSTANTS.SYNC_IDLE,
  _driftCallbacks: [],
  _stateCallbacks: [],
  _suppressEvents: false,

  /**
   * Initialize the reverse sync conductor.
   * @param {object} observer - MCPlayerObserver instance
   * @param {object} embed - MCYouTubeEmbed instance
   */
  init(observer, embed) {
    this._observer = observer;
    this._embed = embed;

    // Listen for Mixcloud player state changes (play/pause)
    this._observer.onStateChange((state) => {
      if (!this._running || this._suppressEvents) return;

      if (state === 'pause') {
        DS_UTILS.log('MC Sync: Mixcloud paused → pausing YT embed');
        this._suppressEvents = true;
        this._embed.pause();
        this._setState(DS_CONSTANTS.SYNC_PAUSED);
        setTimeout(() => { this._suppressEvents = false; }, 200);
      } else if (state === 'play') {
        DS_UTILS.log('MC Sync: Mixcloud playing → resuming YT embed');
        this._suppressEvents = true;
        // Seek YT to match Mixcloud position before playing
        const mcPos = this._observer.getPosition();
        this._embed.seek(mcPos);
        this._embed.play();
        this._setState(DS_CONSTANTS.SYNC_SYNCING);
        setTimeout(() => { this._suppressEvents = false; }, 200);
      }
    });

    this._setState(DS_CONSTANTS.SYNC_LOADING);
    DS_UTILS.log('MC Sync Conductor: initialized');
  },

  /**
   * Start the linked playback.
   */
  start() {
    DS_UTILS.log('MC Sync: starting');
    this._setState(DS_CONSTANTS.SYNC_BUFFERING);

    // Seek YouTube to match Mixcloud position
    const mcPosition = this._observer.getPosition();
    this._embed.seek(mcPosition);

    // If Mixcloud is playing, play the embed too
    if (!this._observer.isPaused()) {
      this._embed.play();
    }

    // Start the drift correction loop
    this._running = true;
    this._lastCheckTime = performance.now();
    this._driftLoop();

    this._setState(DS_CONSTANTS.SYNC_SYNCING);
    DS_UTILS.log('MC Sync: started at position', mcPosition);
  },

  /**
   * The drift correction loop.
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

      this._driftLoop();
    });
  },

  /**
   * Check drift between Mixcloud (primary) and YouTube embed (secondary).
   */
  _checkAndCorrectDrift() {
    if (!this._observer || !this._embed) return;
    if (this._observer.isPaused()) return;

    const mcTime = this._observer.getPosition();
    const ytTime = this._embed.getPosition();

    // Drift: positive = YT is behind, negative = YT is ahead
    const drift = (mcTime - ytTime) * 1000; // ms
    this._currentDrift = drift;
    const absDrift = Math.abs(drift);

    // Notify listeners
    this._driftCallbacks.forEach((cb) => cb(drift));

    // Apply corrections
    if (absDrift <= DS_CONSTANTS.DRIFT_OK) {
      // Perfect — no correction needed
    } else if (absDrift <= 200) {
      // Moderate drift — seek the YT embed to match
      if (absDrift > 80) {
        this._embed.seek(mcTime);
      }
    } else {
      // Large drift — hard seek
      DS_UTILS.log('MC Sync: large drift', drift, 'ms — hard seek');
      this._embed.seek(mcTime);
    }
  },

  /**
   * Force a re-link.
   */
  resync() {
    if (!this._running) return;
    DS_UTILS.log('MC Sync: manual resync');
    this._setState(DS_CONSTANTS.SYNC_BUFFERING);

    const mcTime = this._observer.getPosition();
    this._embed.seek(mcTime);

    if (!this._observer.isPaused()) {
      this._embed.play();
    }

    setTimeout(() => {
      this._setState(DS_CONSTANTS.SYNC_SYNCING);
    }, 300);
  },

  // ─── Getters / Listeners ──────────────────────────────────

  getCurrentDrift() { return this._currentDrift; },
  getState() { return this._syncState; },

  onDrift(callback) { this._driftCallbacks.push(callback); },
  onStateChange(callback) { this._stateCallbacks.push(callback); },

  _setState(state) {
    if (this._syncState === state) return;
    this._syncState = state;
    this._stateCallbacks.forEach((cb) => cb(state));
  },

  /**
   * Destroy the conductor.
   */
  destroy() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._observer = null;
    this._embed = null;
    this._driftCallbacks = [];
    this._stateCallbacks = [];
    this._currentDrift = 0;
    this._suppressEvents = false;
    this._syncState = DS_CONSTANTS.SYNC_IDLE;
    DS_UTILS.log('MC Sync Conductor: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.MCSyncConductor = MCSyncConductor;
}
