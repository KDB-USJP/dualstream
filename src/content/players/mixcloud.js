/**
 * DualStream — Mixcloud Player Adapter
 * 
 * Manages a Mixcloud embedded widget iframe and exposes a unified
 * player interface for the sync conductor.
 */

const DSMixcloudPlayer = {
  _widget: null,
  _iframe: null,
  _container: null,
  _ready: false,
  _cachedPosition: 0,
  _cachedDuration: 0,
  _cachedTimestamp: 0,
  _progressCallbacks: [],
  _stateCallbacks: [],

  /**
   * Initialize the Mixcloud player with a Mixcloud URL.
   * @param {string} url - Full Mixcloud URL (e.g. https://www.mixcloud.com/artist/show/)
   * @param {HTMLElement} mountTarget - DOM element to append the player container to
   * @returns {Promise<void>}
   */
  async init(url, mountTarget) {
    DS_UTILS.log('Mixcloud adapter: initializing with', url);

    const feedKey = DS_UTILS.extractMixcloudKey(url);
    const embedUrl = DS_UTILS.buildMixcloudEmbedUrl(feedKey);

    // Create container
    this._container = document.createElement('div');
    this._container.id = 'dualstream-mixcloud-container';
    this._container.classList.add('dualstream-audio-container');

    // Create the Mixcloud iframe
    this._iframe = document.createElement('iframe');
    this._iframe.id = 'dualstream-mixcloud-iframe';
    this._iframe.width = '100%';
    this._iframe.height = '60';
    this._iframe.src = embedUrl;
    this._iframe.frameBorder = '0';
    this._iframe.allow = 'autoplay';
    this._iframe.setAttribute('loading', 'eager');

    this._container.appendChild(this._iframe);
    mountTarget.appendChild(this._container);

    // Initialize the widget (Mixcloud API is pre-loaded via manifest content_scripts)
    await this._initWidget();

    DS_UTILS.log('Mixcloud adapter: ready');
  },

  /**
   * Initialize the Mixcloud PlayerWidget on the iframe.
   * Waits for the iframe to load before initializing the widget API.
   * @returns {Promise<void>}
   */
  async _initWidget() {
    // Wait for the iframe to finish loading
    await this._waitForIframeLoad();
    DS_UTILS.log('Mixcloud iframe loaded, initializing widget API...');

    return new Promise((resolve, reject) => {
      // Timeout after 15 seconds to avoid hanging forever
      const timeout = setTimeout(() => {
        DS_UTILS.error('Mixcloud widget ready timeout — the widget may not have loaded correctly');
        reject(new Error('Mixcloud widget initialization timed out'));
      }, 15000);

      try {
        /* global Mixcloud */
        this._widget = Mixcloud.PlayerWidget(this._iframe);
        this._widget.ready.then(() => {
          clearTimeout(timeout);
          this._ready = true;
          this._setupEventListeners();
          DS_UTILS.log('Mixcloud widget ready');
          resolve();
        });
      } catch (e) {
        clearTimeout(timeout);
        DS_UTILS.error('Failed to init Mixcloud widget', e);
        reject(e);
      }
    });
  },

  /**
   * Wait for the Mixcloud iframe to finish loading.
   * @returns {Promise<void>}
   */
  _waitForIframeLoad() {
    return new Promise((resolve) => {
      if (!this._iframe) { resolve(); return; }

      // If iframe is already loaded
      try {
        if (this._iframe.contentDocument &&
            this._iframe.contentDocument.readyState === 'complete') {
          resolve();
          return;
        }
      } catch {
        // Cross-origin iframe — can't check readyState, wait for load event
      }

      const onLoad = () => {
        this._iframe.removeEventListener('load', onLoad);
        resolve();
      };
      this._iframe.addEventListener('load', onLoad);

      // Safety timeout: resolve after 10s even if load never fires
      setTimeout(() => {
        this._iframe.removeEventListener('load', onLoad);
        DS_UTILS.warn('Iframe load timeout, proceeding anyway');
        resolve();
      }, 10000);
    });
  },

  /**
   * Set up event listeners on the widget for position caching.
   */
  _setupEventListeners() {
    // Cache position from progress events to reduce async calls
    this._widget.events.progress.on((position, duration) => {
      this._cachedPosition = position;
      this._cachedDuration = duration;
      this._cachedTimestamp = performance.now();
      this._progressCallbacks.forEach((cb) => cb(position, duration));
    });

    this._widget.events.play.on(() => {
      this._stateCallbacks.forEach((cb) => cb('play'));
    });

    this._widget.events.pause.on(() => {
      this._stateCallbacks.forEach((cb) => cb('pause'));
    });

    this._widget.events.buffering.on(() => {
      this._stateCallbacks.forEach((cb) => cb('buffering'));
    });

    this._widget.events.ended.on(() => {
      this._stateCallbacks.forEach((cb) => cb('ended'));
    });

    this._widget.events.error.on(() => {
      this._stateCallbacks.forEach((cb) => cb('error'));
    });
  },

  /**
   * Play the audio.
   * @returns {Promise<void>}
   */
  async play() {
    if (!this._ready) return;
    return this._widget.play();
  },

  /**
   * Pause the audio.
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this._ready) return;
    return this._widget.pause();
  },

  /**
   * Toggle play/pause.
   * @returns {Promise<void>}
   */
  async togglePlay() {
    if (!this._ready) return;
    return this._widget.togglePlay();
  },

  /**
   * Seek to a position in seconds.
   * @param {number} seconds
   * @returns {Promise<boolean>}
   */
  async seek(seconds) {
    if (!this._ready) return false;
    const result = await this._widget.seek(seconds);
    // Update cached position immediately after seek
    this._cachedPosition = seconds;
    this._cachedTimestamp = performance.now();
    return result;
  },

  /**
   * Get the current playback position in seconds.
   * Uses cached value + elapsed time estimate for fast access.
   * @param {boolean} [precise=false] - If true, queries the widget directly (async).
   * @returns {Promise<number>|number}
   */
  getPosition(precise = false) {
    if (precise && this._ready) {
      return this._widget.getPosition();
    }
    // Estimate from cached position + elapsed time
    const elapsed = (performance.now() - this._cachedTimestamp) / 1000;
    return this._cachedPosition + elapsed;
  },

  /**
   * Get the total duration in seconds.
   * @returns {Promise<number>}
   */
  async getDuration() {
    if (!this._ready) return 0;
    if (this._cachedDuration > 0) return this._cachedDuration;
    return this._widget.getDuration();
  },

  /**
   * Check if the player is paused.
   * @returns {Promise<boolean>}
   */
  async isPaused() {
    if (!this._ready) return true;
    return this._widget.getIsPaused();
  },

  /**
   * Set playback rate. 
   * NOTE: Mixcloud widget does NOT support playback rate changes.
   * This is a no-op for Mixcloud — drift correction uses seek instead.
   * @param {number} rate
   */
  setPlaybackRate(rate) {
    // Not supported by Mixcloud widget API
    // Drift correction for Mixcloud will use micro-seeks instead
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
   * @param {Function} callback - Receives state string
   */
  onStateChange(callback) {
    this._stateCallbacks.push(callback);
  },

  /**
   * Show the player container.
   */
  show() {
    if (this._container) {
      this._container.classList.add('dualstream-audio-visible');
    }
  },

  /**
   * Minimize the player container (still visible per Mixcloud API requirement).
   */
  minimize() {
    if (this._container) {
      this._container.classList.remove('dualstream-audio-visible');
    }
  },

  /**
   * Check if this adapter supports playback rate adjustment.
   * @returns {boolean}
   */
  supportsPlaybackRate() {
    return false;
  },

  /**
   * Destroy the player and clean up.
   */
  destroy() {
    this._ready = false;
    this._widget = null;
    this._progressCallbacks = [];
    this._stateCallbacks = [];
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._iframe = null;
    this._cachedPosition = 0;
    this._cachedDuration = 0;
    this._cachedTimestamp = 0;
    DS_UTILS.log('Mixcloud adapter: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.DSMixcloudPlayer = DSMixcloudPlayer;
}
