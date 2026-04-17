/**
 * DualStream — Generic Audio Player Adapter
 * 
 * Handles direct audio URLs (mp3, ogg, wav, etc.) via a standard
 * HTML5 <audio> element. Provides the same interface as the Mixcloud adapter.
 */

const DSGenericPlayer = {
  _audio: null,
  _container: null,
  _progressCallbacks: [],
  _stateCallbacks: [],
  _progressInterval: null,

  /**
   * Initialize the generic audio player with a direct audio URL.
   * @param {string} url - Direct audio file URL
   * @param {HTMLElement} mountTarget - DOM element to append the player to
   * @returns {Promise<void>}
   */
  async init(url, mountTarget) {
    DS_UTILS.log('Generic adapter: initializing with', url);

    // Create container
    this._container = document.createElement('div');
    this._container.id = 'dualstream-generic-container';
    this._container.classList.add('dualstream-audio-container');

    // Create audio element
    this._audio = new Audio();
    this._audio.crossOrigin = 'anonymous';
    this._audio.preload = 'auto';
    this._audio.src = url;

    // Visual audio controls (hidden by default, shown when expanded)
    this._audio.controls = true;
    this._audio.style.width = '100%';
    this._container.appendChild(this._audio);
    mountTarget.appendChild(this._container);

    // Set up event listeners
    this._setupEventListeners();

    // Wait for the audio to be ready
    return new Promise((resolve, reject) => {
      const onCanPlay = () => {
        this._audio.removeEventListener('canplay', onCanPlay);
        this._audio.removeEventListener('error', onError);
        DS_UTILS.log('Generic adapter: ready');
        resolve();
      };
      const onError = (e) => {
        this._audio.removeEventListener('canplay', onCanPlay);
        this._audio.removeEventListener('error', onError);
        DS_UTILS.error('Generic adapter: load error', e);
        reject(new Error('Failed to load audio: ' + url));
      };
      this._audio.addEventListener('canplay', onCanPlay);
      this._audio.addEventListener('error', onError);
    });
  },

  /**
   * Set up event listeners on the audio element.
   */
  _setupEventListeners() {
    this._audio.addEventListener('play', () => {
      this._stateCallbacks.forEach((cb) => cb('play'));
    });

    this._audio.addEventListener('pause', () => {
      this._stateCallbacks.forEach((cb) => cb('pause'));
    });

    this._audio.addEventListener('waiting', () => {
      this._stateCallbacks.forEach((cb) => cb('buffering'));
    });

    this._audio.addEventListener('ended', () => {
      this._stateCallbacks.forEach((cb) => cb('ended'));
    });

    this._audio.addEventListener('error', () => {
      this._stateCallbacks.forEach((cb) => cb('error'));
    });

    // Progress reporting
    this._audio.addEventListener('timeupdate', () => {
      const position = this._audio.currentTime;
      const duration = this._audio.duration || 0;
      this._progressCallbacks.forEach((cb) => cb(position, duration));
    });
  },

  /**
   * Play the audio.
   * @returns {Promise<void>}
   */
  async play() {
    if (!this._audio) return;
    return this._audio.play();
  },

  /**
   * Pause the audio.
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this._audio) return;
    this._audio.pause();
  },

  /**
   * Toggle play/pause.
   * @returns {Promise<void>}
   */
  async togglePlay() {
    if (!this._audio) return;
    if (this._audio.paused) {
      return this._audio.play();
    } else {
      this._audio.pause();
    }
  },

  /**
   * Seek to a position in seconds.
   * @param {number} seconds
   * @returns {Promise<boolean>}
   */
  async seek(seconds) {
    if (!this._audio) return false;
    try {
      this._audio.currentTime = seconds;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get the current playback position in seconds.
   * Synchronous for generic audio — no async overhead.
   * @param {boolean} [precise=false] - Ignored for generic (always precise).
   * @returns {number}
   */
  getPosition(_precise = false) {
    if (!this._audio) return 0;
    return this._audio.currentTime;
  },

  /**
   * Get the total duration in seconds.
   * @returns {Promise<number>}
   */
  async getDuration() {
    if (!this._audio) return 0;
    return this._audio.duration || 0;
  },

  /**
   * Check if the player is paused.
   * @returns {Promise<boolean>}
   */
  async isPaused() {
    if (!this._audio) return true;
    return this._audio.paused;
  },

  /**
   * Set playback rate.
   * Generic audio fully supports this for gentle drift correction.
   * @param {number} rate
   */
  setPlaybackRate(rate) {
    if (!this._audio) return;
    this._audio.playbackRate = rate;
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
   * Minimize the player container.
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
    return true;
  },

  /**
   * Destroy the player and clean up.
   */
  destroy() {
    if (this._audio) {
      this._audio.pause();
      this._audio.src = '';
      this._audio = null;
    }
    this._progressCallbacks = [];
    this._stateCallbacks = [];
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    DS_UTILS.log('Generic adapter: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.DSGenericPlayer = DSGenericPlayer;
}
