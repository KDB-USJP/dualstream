/**
 * DualStream — Shared Utilities
 */

const DS_UTILS = {
  /**
   * Classify a URL as Mixcloud or generic audio.
   * @param {string} url
   * @returns {{ type: string, url: string }}
   */
  classifyUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes(DS_CONSTANTS.MIXCLOUD_DOMAIN)) {
        return { type: DS_CONSTANTS.SOURCE_MIXCLOUD, url };
      }
      return { type: DS_CONSTANTS.SOURCE_GENERIC, url };
    } catch {
      return { type: DS_CONSTANTS.SOURCE_GENERIC, url };
    }
  },

  /**
   * Extract the Mixcloud feed key from a full Mixcloud URL.
   * e.g. "https://www.mixcloud.com/artist/show-name/" → "/artist/show-name/"
   * @param {string} url
   * @returns {string}
   */
  extractMixcloudKey(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname; // e.g. "/artist/show-name/"
    } catch {
      return url;
    }
  },

  /**
   * Build a Mixcloud embed iframe URL from a feed key.
   * @param {string} feedKey - e.g. "/artist/show-name/"
   * @returns {string}
   */
  buildMixcloudEmbedUrl(feedKey) {
    const params = new URLSearchParams({
      feed: feedKey,
      hide_cover: '1',
      mini: '1',
      light: '1',
      hide_artwork: '0',
    });
    return `${DS_CONSTANTS.MIXCLOUD_EMBED_BASE}?${params.toString()}`;
  },

  /**
   * Debounce a function.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /**
   * Load settings from chrome.storage.sync, with defaults.
   * @returns {Promise<object>}
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DS_CONSTANTS.DEFAULT_SETTINGS, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * Save settings to chrome.storage.sync.
   * @param {object} settings - Partial settings to merge.
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, resolve);
    });
  },

  /**
   * Format milliseconds into a human-readable string.
   * @param {number} ms
   * @returns {string}
   */
  formatDrift(ms) {
    const abs = Math.abs(Math.round(ms));
    if (abs < 1) return '0ms';
    const sign = ms > 0 ? '+' : '-';
    return `${sign}${abs}ms`;
  },

  /**
   * Send a message via chrome.runtime and get a response.
   * @param {object} message
   * @returns {Promise<any>}
   */
  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  },

  /**
   * Log with DualStream prefix.
   * @param  {...any} args
   */
  log(...args) {
    console.log('[DualStream]', ...args);
  },

  /**
   * Warn with DualStream prefix.
   * @param  {...any} args
   */
  warn(...args) {
    console.warn('[DualStream]', ...args);
  },

  /**
   * Error with DualStream prefix.
   * @param  {...any} args
   */
  error(...args) {
    console.error('[DualStream]', ...args);
  },
};

if (typeof window !== 'undefined') {
  window.DS_UTILS = DS_UTILS;
}
