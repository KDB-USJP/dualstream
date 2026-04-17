/**
 * DualStream — Mixcloud Page UI
 *
 * Injects the "Open Linked Video" button and toast notifications
 * on Mixcloud show pages when a |||youtube-url||| is detected.
 */

const MCUI = {
  _container: null,
  _button: null,
  _sourceInfo: null,
  _onOpenClick: null,

  /**
   * Initialize the UI.
   * @param {object} callbacks
   * @param {Function} callbacks.onOpenClick - Called when "Open Video" is clicked
   */
  init(callbacks = {}) {
    this._onOpenClick = callbacks.onOpenClick || (() => {});
    this._injectUI();
    DS_UTILS.log('MC UI: initialized');
  },

  /**
   * Show the button.
   * @param {{ type: string, url: string }} sourceInfo
   */
  showButton(sourceInfo) {
    this._sourceInfo = sourceInfo;
    if (this._button) {
      this._button.style.display = 'inline-flex';
    }
  },

  /**
   * Hide the button.
   */
  hideButton() {
    if (this._button) {
      this._button.style.display = 'none';
    }
  },

  /**
   * Update button state to active (video is open).
   */
  setActive(active) {
    if (!this._button) return;
    const label = this._button.querySelector('.dualstream-mc-btn-label');
    if (active) {
      label.textContent = 'Close Linked Video';
      this._button.classList.add('dualstream-mc-btn-active');
    } else {
      label.textContent = '🎥 Open Linked Video';
      this._button.classList.remove('dualstream-mc-btn-active');
    }
  },

  /**
   * Show a toast notification.
   */
  showToast(message, duration = 4000) {
    // Remove existing toast
    const existing = document.querySelector('.dualstream-mc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'dualstream-mc-toast';
    toast.innerHTML = `
      <span class="dualstream-mc-toast-icon">🎬</span>
      <span class="dualstream-mc-toast-text">${message}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('dualstream-mc-toast-visible');
    });

    setTimeout(() => {
      toast.classList.remove('dualstream-mc-toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  // ─── Private ──────────────────────────────────────────────

  _injectUI() {
    const existing = document.getElementById(DS_CONSTANTS.MC_CONTAINER_ID);
    if (existing) existing.remove();

    this._container = document.createElement('div');
    this._container.id = DS_CONSTANTS.MC_CONTAINER_ID;

    // Create the button
    this._button = document.createElement('button');
    this._button.id = DS_CONSTANTS.MC_BUTTON_ID;
    this._button.className = 'dualstream-mc-btn';
    this._button.style.display = 'none';
    this._button.innerHTML = `
      <span class="dualstream-mc-btn-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
          <polygon points="10,8 16,12 10,16"/>
        </svg>
      </span>
      <span class="dualstream-mc-btn-label">🎥 Open Linked Video</span>
    `;

    this._button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._onOpenClick();
    });

    this._container.appendChild(this._button);

    // Find insertion point near the Mixcloud action buttons
    this._waitForInsertionPoint().then((target) => {
      if (target) {
        target.insertAdjacentElement('afterend', this._container);
      } else {
        // Fallback: insert near top of page content
        const main = document.querySelector('main') ||
                     document.querySelector('[role="main"]') ||
                     document.querySelector('#content') ||
                     document.body;
        main.insertBefore(this._container, main.children[1] || null);
      }
    });
  },

  _waitForInsertionPoint() {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        // Try Mixcloud's action bar selectors
        for (const sel of DS_CONSTANTS.MC_ACTION_BAR_SELECTORS) {
          const el = document.querySelector(sel);
          if (el) { resolve(el); return; }
        }

        // Fallback: find button row (Favorite, Repost, Share, etc.)
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent || '';
          if (text.includes('Favorite') || text.includes('Repost') || text.includes('Share')) {
            const parent = btn.closest('div');
            if (parent) { resolve(parent); return; }
          }
        }

        attempts++;
        if (attempts < 20) {
          setTimeout(check, 500);
        } else {
          resolve(null);
        }
      };
      setTimeout(check, 500);
    });
  },

  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._button = null;
    this._sourceInfo = null;
    DS_UTILS.log('MC UI: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.MCUI = MCUI;
}
