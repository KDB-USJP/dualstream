/**
 * DualStream — Picture-in-Picture Overlay (for Mixcloud pages)
 *
 * Draggable, resizable, fullscreen-capable floating video window
 * that contains the YouTube embed iframe.
 */

const MCPiP = {
  _container: null,
  _header: null,
  _videoContainer: null,
  _isDragging: false,
  _isResizing: false,
  _dragOffset: { x: 0, y: 0 },
  _resizeStart: { x: 0, y: 0, w: 0, h: 0 },
  _minimized: false,
  _onCloseCallback: null,
  _driftDisplay: null,

  // Default size and position
  DEFAULT_WIDTH: 400,
  DEFAULT_HEIGHT: 225,
  MIN_WIDTH: 240,
  MIN_HEIGHT: 135,
  ASPECT_RATIO: 16 / 9,

  /**
   * Create and mount the PiP overlay.
   * @param {object} options
   * @param {Function} options.onClose - Called when PiP is closed
   * @param {Function} options.onResync - Called when resync is clicked
   * @returns {HTMLElement} - The video container to mount the iframe in
   */
  init(options = {}) {
    this._onCloseCallback = options.onClose || (() => {});
    this._onResyncCallback = options.onResync || (() => {});

    // Remove existing PiP
    const existing = document.getElementById(DS_CONSTANTS.MC_PIP_ID);
    if (existing) existing.remove();

    // Create container
    this._container = document.createElement('div');
    this._container.id = DS_CONSTANTS.MC_PIP_ID;
    this._container.className = 'dualstream-pip';
    this._container.innerHTML = this._getTemplate();

    document.body.appendChild(this._container);

    // Cache references
    this._header = this._container.querySelector('.dualstream-pip-header');
    this._videoContainer = this._container.querySelector('.dualstream-pip-video');
    this._driftDisplay = this._container.querySelector('.dualstream-pip-drift');

    // Set initial position (bottom-right)
    this._loadPosition();

    // Bind events
    this._bindDrag();
    this._bindResize();
    this._bindButtons();

    DS_UTILS.log('MC PiP: created');
    return this._videoContainer;
  },

  /**
   * Get the HTML template for the PiP overlay.
   */
  _getTemplate() {
    return `
      <div class="dualstream-pip-header">
        <div class="dualstream-pip-info">
          <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="dualstream-vinyl" alt="DS" />
          <span class="dualstream-pip-title">DualStream</span>
          <span class="dualstream-pip-drift">—</span>
        </div>
        <div class="dualstream-pip-controls">
          <button class="dualstream-pip-resync" title="Re-link">⟳</button>
          <button class="dualstream-pip-minimize" title="Minimize">─</button>
          <button class="dualstream-pip-fullscreen" title="Fullscreen">⛶</button>
          <button class="dualstream-pip-close" title="Close">✕</button>
        </div>
      </div>
      <div class="dualstream-pip-video"></div>
      <div class="dualstream-pip-resize-handle"></div>
    `;
  },

  /**
   * Update the drift display.
   * @param {number} driftMs
   */
  updateDrift(driftMs) {
    if (this._driftDisplay) {
      this._driftDisplay.textContent = `Drift: ${DS_UTILS.formatDrift(driftMs)}`;

      // Color based on magnitude
      const abs = Math.abs(driftMs);
      if (abs <= DS_CONSTANTS.DRIFT_OK) {
        this._driftDisplay.style.color = 'var(--ds-success)';
      } else if (abs <= DS_CONSTANTS.DRIFT_WARN) {
        this._driftDisplay.style.color = 'var(--ds-warning)';
      } else {
        this._driftDisplay.style.color = 'var(--ds-error)';
      }
    }
  },

  /**
   * Get the video container (for mounting the embed iframe).
   */
  getVideoContainer() {
    return this._videoContainer;
  },

  // ─── Drag Logic ───────────────────────────────────────────

  _bindDrag() {
    if (!this._header) return;

    this._header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return; // Don't drag when clicking buttons
      this._isDragging = true;
      const rect = this._container.getBoundingClientRect();
      this._dragOffset.x = e.clientX - rect.left;
      this._dragOffset.y = e.clientY - rect.top;
      this._container.classList.add('dualstream-pip-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const x = e.clientX - this._dragOffset.x;
      const y = e.clientY - this._dragOffset.y;

      // Clamp to viewport
      const maxX = window.innerWidth - this._container.offsetWidth;
      const maxY = window.innerHeight - this._container.offsetHeight;
      this._container.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this._container.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
      this._container.style.right = 'auto';
      this._container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (this._isDragging) {
        this._isDragging = false;
        this._container.classList.remove('dualstream-pip-dragging');
        this._savePosition();
      }
    });
  },

  // ─── Resize Logic ──────────────────────────────────────────

  _bindResize() {
    const handle = this._container?.querySelector('.dualstream-pip-resize-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      this._isResizing = true;
      this._resizeStart = {
        x: e.clientX,
        y: e.clientY,
        w: this._container.offsetWidth,
        h: this._container.offsetHeight,
      };
      this._container.classList.add('dualstream-pip-resizing');
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._isResizing) return;
      const deltaX = e.clientX - this._resizeStart.x;
      let newW = Math.max(this.MIN_WIDTH, this._resizeStart.w + deltaX);
      let newH = newW / this.ASPECT_RATIO;

      if (newH < this.MIN_HEIGHT) {
        newH = this.MIN_HEIGHT;
        newW = newH * this.ASPECT_RATIO;
      }

      this._container.style.width = `${newW}px`;
      this._container.style.height = 'auto';
      if (this._videoContainer) {
        this._videoContainer.style.height = `${newH}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (this._isResizing) {
        this._isResizing = false;
        this._container.classList.remove('dualstream-pip-resizing');
        this._savePosition();
      }
    });
  },

  // ─── Button Handlers ──────────────────────────────────────

  _bindButtons() {
    // Close
    const closeBtn = this._container.querySelector('.dualstream-pip-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this._onCloseCallback();
      });
    }

    // Minimize
    const minBtn = this._container.querySelector('.dualstream-pip-minimize');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        this._toggleMinimize();
      });
    }

    // Fullscreen
    const fsBtn = this._container.querySelector('.dualstream-pip-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        this._toggleFullscreen();
      });
    }

    // Resync
    const resyncBtn = this._container.querySelector('.dualstream-pip-resync');
    if (resyncBtn) {
      resyncBtn.addEventListener('click', () => {
        this._onResyncCallback();
      });
    }
  },

  _toggleMinimize() {
    this._minimized = !this._minimized;
    if (this._minimized) {
      this._container.classList.add('dualstream-pip-minimized');
    } else {
      this._container.classList.remove('dualstream-pip-minimized');
    }
  },

  _toggleFullscreen() {
    const iframe = this._videoContainer?.querySelector('iframe');
    if (iframe) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        iframe.requestFullscreen().catch(() => {
          // Fullscreen might be blocked
          DS_UTILS.warn('MC PiP: Fullscreen request denied');
        });
      }
    }
  },

  // ─── Position Persistence ─────────────────────────────────

  _savePosition() {
    try {
      const rect = this._container.getBoundingClientRect();
      chrome.storage.local.set({
        pipPosition: {
          left: rect.left,
          top: rect.top,
          width: this._container.offsetWidth,
        },
      });
    } catch {
      // Storage may not be available
    }
  },

  _loadPosition() {
    try {
      chrome.storage.local.get('pipPosition', (result) => {
        if (result.pipPosition) {
          const { left, top, width } = result.pipPosition;
          this._container.style.left = `${left}px`;
          this._container.style.top = `${top}px`;
          this._container.style.right = 'auto';
          this._container.style.bottom = 'auto';
          if (width) {
            this._container.style.width = `${width}px`;
            if (this._videoContainer) {
              this._videoContainer.style.height = `${width / this.ASPECT_RATIO}px`;
            }
          }
        } else {
          // Default: bottom-right corner
          this._container.style.right = '20px';
          this._container.style.bottom = '80px'; // Above Mixcloud's player bar
          this._container.style.width = `${this.DEFAULT_WIDTH}px`;
          if (this._videoContainer) {
            this._videoContainer.style.height = `${this.DEFAULT_HEIGHT}px`;
          }
        }
      });
    } catch {
      // Default position
      this._container.style.right = '20px';
      this._container.style.bottom = '80px';
      this._container.style.width = `${this.DEFAULT_WIDTH}px`;
    }
  },

  // ─── Cleanup ──────────────────────────────────────────────

  show() {
    if (this._container) this._container.style.display = 'flex';
  },

  hide() {
    if (this._container) this._container.style.display = 'none';
  },

  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._header = null;
    this._videoContainer = null;
    this._driftDisplay = null;
    this._minimized = false;
    DS_UTILS.log('MC PiP: destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.MCPiP = MCPiP;
}
