/**
 * DualStream — Description Parser
 * 
 * Watches for YouTube SPA navigation events and parses
 * video descriptions for |||url||| patterns.
 */

const DSParser = {
  _observer: null,
  _currentVideoId: null,
  _onFoundCallbacks: [],
  _onClearedCallbacks: [],

  /**
   * Initialize the parser. Sets up SPA navigation detection.
   */
  init() {
    DS_UTILS.log('Parser initialized');
    this._setupNavigationListener();
    // Initial check (in case we loaded on a watch page directly)
    this._scheduleCheck();
  },

  /**
   * Register a callback for when a DualStream URL is found.
   * @param {Function} callback - Receives { type, url }
   */
  onFound(callback) {
    this._onFoundCallbacks.push(callback);
  },

  /**
   * Register a callback for when no URL is present (navigation away, etc.).
   * @param {Function} callback
   */
  onCleared(callback) {
    this._onClearedCallbacks.push(callback);
  },

  /**
   * Set up listeners for YouTube's SPA navigation.
   * YouTube fires a custom 'yt-navigate-finish' event on page transitions.
   */
  _setupNavigationListener() {
    // YT SPA navigation event
    document.addEventListener('yt-navigate-finish', () => {
      DS_UTILS.log('YT navigation detected');
      this._scheduleCheck();
    });

    // Also observe URL changes as a fallback
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        DS_UTILS.log('URL change detected');
        this._scheduleCheck();
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });
  },

  /**
   * Schedule a description check with a small delay
   * to let YT finish rendering the new page.
   */
  _scheduleCheck() {
    // Extract video ID from URL
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');

    if (!videoId) {
      this._notifyCleared();
      return;
    }

    // If same video, don't re-parse
    if (videoId === this._currentVideoId) return;
    this._currentVideoId = videoId;

    // Wait for description to render (YT lazy-loads it)
    this._waitForDescription().then((descText) => {
      if (descText) {
        this._parseDescription(descText);
      } else {
        DS_UTILS.warn('Could not find description text');
        this._notifyCleared();
      }
    });
  },

  /**
   * Wait for the description element to appear in the DOM.
   * YouTube lazy-loads description content.
   * @returns {Promise<string|null>}
   */
  _waitForDescription() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 30 * 500ms = 15 seconds max wait

      const check = () => {
        // Try multiple selectors (YT changes their DOM occasionally)
        const descEl =
          document.querySelector('#description-inline-expander') ||
          document.querySelector('ytd-text-inline-expander#description-inline-expander') ||
          document.querySelector('#description ytd-text-inline-expander') ||
          document.querySelector('#description yt-attributed-string') ||
          document.querySelector('#description');

        if (descEl) {
          const text = descEl.textContent || descEl.innerText || '';
          if (text.trim().length > 0) {
            resolve(text);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          resolve(null);
        }
      };

      // Start checking after a brief delay
      setTimeout(check, 300);
    });
  },

  /**
   * Parse the description text for |||url||| patterns.
   * @param {string} text
   */
  _parseDescription(text) {
    const regex = new RegExp(DS_CONSTANTS.URL_PATTERN.source, 'g');
    const matches = [];
    let match;

    DS_UTILS.log('Parsing description, length:', text.length);

    while ((match = regex.exec(text)) !== null) {
      let url = match[1].trim();
      if (url) {
        // Reconstruct URL: YT auto-shortens https:// links, so the convention
        // uses ps:// (dropping "htt") to prevent shortening. Prepend it back.
        if (url.startsWith('ps://') || url.startsWith('p://')) {
          url = 'htt' + url;
          DS_UTILS.log('Reconstructed URL from YT-safe format:', url);
        }
        matches.push(DS_UTILS.classifyUrl(url));
      }
    }

    if (matches.length > 0) {
      DS_UTILS.log('Found DualStream URL(s):', matches);
      // Use the first match (primary audio source)
      this._onFoundCallbacks.forEach((cb) => cb(matches[0], matches));
    } else {
      DS_UTILS.log('No |||url||| pattern found in description');
      this._notifyCleared();
    }
  },

  /**
   * Notify that no DualStream URLs are present.
   */
  _notifyCleared() {
    this._currentVideoId = null;
    this._onClearedCallbacks.forEach((cb) => cb());
  },

  /**
   * Destroy the parser and clean up observers.
   */
  destroy() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._onFoundCallbacks = [];
    this._onClearedCallbacks = [];
    this._currentVideoId = null;
  },
};

if (typeof window !== 'undefined') {
  window.DSParser = DSParser;
}
