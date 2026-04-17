/**
 * DualStream — YouTube Embed Adapter (for Mixcloud pages)
 *
 * Creates and controls a muted YouTube embed iframe on Mixcloud pages,
 * using the bundled DSYouTubePlayer postMessage API.
 */

const MCYouTubeEmbed = {
  _iframe: null,
  _player: null,
  _ready: false,
  _videoId: null,
  _stateCallbacks: [],

  /**
   * Initialize the YouTube embed.
   * @param {string} videoId - YouTube video ID
   * @param {HTMLElement} container - DOM element to mount the iframe in
   * @returns {Promise<void>}
   */
  async init(videoId, container) {
    this._videoId = videoId;
    DS_UTILS.log('MC YT Embed: initializing with video', videoId);

    // Create the iframe
    this._iframe = document.createElement('iframe');
    this._iframe.id = 'dualstream-yt-embed';
    this._iframe.width = '100%';
    this._iframe.height = '100%';
    this._iframe.src = DS_UTILS.buildYouTubeEmbedUrl(videoId);
    this._iframe.frameBorder = '0';
    this._iframe.allow = 'autoplay; encrypted-media';
    this._iframe.allowFullscreen = true;
    this._iframe.setAttribute('loading', 'eager');
    this._iframe.style.cssText = 'border:none; border-radius:8px;';

    container.appendChild(this._iframe);

    // Initialize the player API
    await this._initPlayer();
  },

  /**
   * Initialize the DSYouTubePlayer on the iframe.
   * @returns {Promise<void>}
   */
  _initPlayer() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // If not ready after 20s, resolve anyway — the embed might still work
        DS_UTILS.warn('MC YT Embed: ready timeout, proceeding anyway');
        this._ready = true;
        resolve();
      }, 20000);

      try {
        /* global DSYouTubePlayer */
        this._player = DSYouTubePlayer(this._iframe);
        this._player.onReady(() => {
          clearTimeout(timeout);
          this._ready = true;
          DS_UTILS.log('MC YT Embed: player ready');
          // Ensure it's muted
          this._player.mute();
          resolve();
        });

        this._player.onStateChange((state) => {
          this._stateCallbacks.forEach((cb) => cb(state));
        });
      } catch (e) {
        clearTimeout(timeout);
        DS_UTILS.error('MC YT Embed: init failed', e);
        reject(e);
      }
    });
  },

  // ─── Public API ───────────────────────────────────────────

  play() {
    if (this._player) this._player.play();
  },

  pause() {
    if (this._player) this._player.pause();
  },

  seek(seconds) {
    if (this._player) this._player.seek(seconds);
  },

  mute() {
    if (this._player) this._player.mute();
  },

  getPosition() {
    return this._player ? this._player.getPosition() : 0;
  },

  getDuration() {
    return this._player ? this._player.getDuration() : 0;
  },

  isPaused() {
    return this._player ? this._player.isPaused() : true;
  },

  isReady() {
    return this._ready;
  },

  onStateChange(callback) {
    this._stateCallbacks.push(callback);
  },

  getIframe() {
    return this._iframe;
  },

  destroy() {
    if (this._player) {
      this._player.destroy();
      this._player = null;
    }
    if (this._iframe && this._iframe.parentNode) {
      this._iframe.parentNode.removeChild(this._iframe);
    }
    this._iframe = null;
    this._ready = false;
    this._stateCallbacks = [];
    DS_UTILS.log('MC YT Embed: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.MCYouTubeEmbed = MCYouTubeEmbed;
}
