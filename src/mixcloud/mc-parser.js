/**
 * DualStream — Mixcloud Description Parser
 *
 * Scans Mixcloud show page descriptions for |||url||| patterns.
 * Same convention as YouTube side, but on Mixcloud pages.
 */

const MCParser = {
  _onFoundCallbacks: [],
  _onClearedCallbacks: [],
  _lastPath: null,

  /**
   * Initialize the parser.
   */
  init() {
    DS_UTILS.log('MC Parser initialized');
    this._scheduleCheck();
    this._setupNavigationListener();
  },

  /**
   * Register a callback for when a DualStream URL is found.
   * @param {Function} callback - Receives { type, url }
   */
  onFound(callback) {
    this._onFoundCallbacks.push(callback);
  },

  /**
   * Register a callback for when no URL is present.
   * @param {Function} callback
   */
  onCleared(callback) {
    this._onClearedCallbacks.push(callback);
  },

  /**
   * Listen for Mixcloud SPA navigation (client-side routing).
   */
  _setupNavigationListener() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        DS_UTILS.log('MC navigation detected:', lastUrl);
        this._lastPath = null;
        this._scheduleCheck();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      this._lastPath = null;
      this._scheduleCheck();
    });
  },

  /**
   * Schedule a description check.
   */
  _scheduleCheck() {
    const path = location.pathname;
    if (path === this._lastPath) return;
    this._lastPath = path;

    this._waitForDescription().then((descText) => {
      if (descText) {
        this._parseDescription(descText);
      } else {
        DS_UTILS.log('MC: No description text found');
        this._notifyCleared();
      }
    });
  },

  /**
   * Wait for the show description to appear in the DOM.
   * @returns {Promise<string|null>}
   */
  _waitForDescription() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30;

      const check = () => {
        // Try Mixcloud's known description selectors
        let descEl = null;
        for (const sel of DS_CONSTANTS.MC_DESCRIPTION_SELECTORS) {
          descEl = document.querySelector(sel);
          if (descEl) break;
        }

        // Fallback: scan all text on the page for the ||| pattern
        if (!descEl) {
          // Look in the main content area
          const mainContent = document.querySelector('main') ||
                              document.querySelector('[role="main"]') ||
                              document.querySelector('#content');
          if (mainContent) {
            const text = mainContent.textContent || '';
            if (text.includes('|||')) {
              resolve(text);
              return;
            }
          }
        }

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
          // Last resort: search entire body
          const fullText = document.body?.textContent || '';
          if (fullText.includes('|||')) {
            resolve(fullText);
          } else {
            resolve(null);
          }
        }
      };

      setTimeout(check, 500);
    });
  },

  /**
   * Parse description text for |||url||| patterns.
   * @param {string} text
   */
  _parseDescription(text) {
    const regex = new RegExp(DS_CONSTANTS.URL_PATTERN.source, 'g');
    const matches = [];
    let match;

    DS_UTILS.log('MC: Parsing description, length:', text.length);

    while ((match = regex.exec(text)) !== null) {
      let url = match[1].trim();
      if (url) {
        // Reconstruct URL from ps:// or p:// convention
        if (url.startsWith('ps://') || url.startsWith('p://')) {
          url = 'htt' + url;
          DS_UTILS.log('MC: Reconstructed URL:', url);
        }
        const classified = DS_UTILS.classifyUrl(url);
        // On Mixcloud pages, we're looking specifically for YouTube or generic video URLs
        if (classified.type === DS_CONSTANTS.SOURCE_YOUTUBE) {
          matches.push(classified);
        }
      }
    }

    if (matches.length > 0) {
      DS_UTILS.log('MC: Found YouTube URL(s):', matches);
      this._onFoundCallbacks.forEach((cb) => cb(matches[0], matches));
    } else {
      DS_UTILS.log('MC: No |||youtube-url||| found in description');
      this._notifyCleared();
    }
  },

  /**
   * Notify that no URLs are present.
   */
  _notifyCleared() {
    this._onClearedCallbacks.forEach((cb) => cb());
  },

  destroy() {
    this._onFoundCallbacks = [];
    this._onClearedCallbacks = [];
    this._lastPath = null;
  },
};

if (typeof window !== 'undefined') {
  window.MCParser = MCParser;
}
