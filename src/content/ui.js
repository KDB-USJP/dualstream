/**
 * DualStream — UI Injection
 * 
 * Injects and manages the DualStream UI on YouTube pages:
 * - Action button ("Link Alternate Audio")
 * - Mini player bar with controls
 * - Status indicators
 */

const DSUI = {
  _container: null,
  _button: null,
  _playerBar: null,
  _statusDot: null,
  _offsetSlider: null,
  _offsetLabel: null,
  _driftDisplay: null,
  _expanded: false,
  _sourceInfo: null,
  _allSources: [],
  _streamPicker: null,
  _onLinkClick: null,
  _onRelinkClick: null,
  _onOffsetChange: null,
  _onStreamSelect: null,
  _onToggleExpand: null,

  /**
   * Initialize the UI. Injects the container below the YT video title.
   * @param {object} callbacks
   * @param {Function} callbacks.onLinkClick - Called when "Link" button is clicked
   * @param {Function} callbacks.onRelinkClick - Called when "Re-link" button is clicked
   * @param {Function} callbacks.onOffsetChange - Called with offset in ms
   */
  init(callbacks = {}) {
    this._onLinkClick = callbacks.onLinkClick || (() => {});
    this._onRelinkClick = callbacks.onRelinkClick || (() => {});
    this._onOffsetChange = callbacks.onOffsetChange || (() => {});
    this._onStreamSelect = callbacks.onStreamSelect || (() => {});

    this._injectUI();
    DS_UTILS.log('UI initialized');
  },

  /**
   * Show the action button (called when |||url||| is detected).
   * @param {{ type: string, url: string, label: string }} sourceInfo
   * @param {Array} [allSources] - All detected sources (for multi-stream)
   */
  showButton(sourceInfo, allSources = []) {
    this._sourceInfo = sourceInfo;
    this._allSources = allSources.length > 0 ? allSources : [sourceInfo];

    if (this._button) {
      this._button.style.display = 'flex';
      const label = this._button.querySelector('.dualstream-btn-label');

      if (this._allSources.length > 1) {
        // Multi-stream: show count
        label.textContent = `Link Alternate Audio (${this._allSources.length} available)`;
      } else {
        // Single stream: show source type
        const sourceLabel = sourceInfo.type === DS_CONSTANTS.SOURCE_MIXCLOUD
          ? '🎧 Mixcloud'
          : '🔊 Audio';
        label.textContent = `Link Alternate Audio (${sourceLabel})`;
      }
    }
  },

  /**
   * Hide the entire DualStream UI.
   */
  hide() {
    if (this._container) {
      this._container.style.display = 'none';
    }
  },

  /**
   * Show the container.
   */
  show() {
    if (this._container) {
      this._container.style.display = 'block';
    }
  },

  /**
   * Update the sync state display.
   * @param {string} state - One of DS_CONSTANTS.SYNC_*
   */
  setState(state) {
    if (!this._statusDot) return;

    // Update status dot
    this._statusDot.className = 'dualstream-status-dot';
    switch (state) {
      case DS_CONSTANTS.SYNC_SYNCING:
        this._statusDot.classList.add('dualstream-status-ok');
        this._statusDot.title = 'Linked';
        break;
      case DS_CONSTANTS.SYNC_BUFFERING:
      case DS_CONSTANTS.SYNC_LOADING:
        this._statusDot.classList.add('dualstream-status-warn');
        this._statusDot.title = 'Buffering...';
        break;
      case DS_CONSTANTS.SYNC_ERROR:
        this._statusDot.classList.add('dualstream-status-error');
        this._statusDot.title = 'Link error';
        break;
      case DS_CONSTANTS.SYNC_PAUSED:
        this._statusDot.classList.add('dualstream-status-paused');
        this._statusDot.title = 'Paused';
        break;
      default:
        this._statusDot.classList.add('dualstream-status-idle');
        this._statusDot.title = 'Idle';
    }

    // Update button text and vinyl spin state
    if (this._button) {
      const label = this._button.querySelector('.dualstream-btn-label');
      const vinyl = this._button.querySelector('.dualstream-vinyl');

      if (state === DS_CONSTANTS.SYNC_SYNCING) {
        label.textContent = 'Unlink Audio';
        this._button.classList.add('dualstream-btn-active');
        this._button.classList.remove('dualstream-btn-loading');
        if (vinyl) {
          vinyl.classList.remove('dualstream-vinyl-hidden', 'dualstream-vinyl-paused');
        }
        this._showPlayerBar();
      } else if (state === DS_CONSTANTS.SYNC_PAUSED) {
        label.textContent = 'Unlink Audio';
        this._button.classList.add('dualstream-btn-active');
        this._button.classList.remove('dualstream-btn-loading');
        if (vinyl) {
          vinyl.classList.remove('dualstream-vinyl-hidden');
          vinyl.classList.add('dualstream-vinyl-paused');
        }
        this._showPlayerBar();
      } else if (state === DS_CONSTANTS.SYNC_LOADING || state === DS_CONSTANTS.SYNC_BUFFERING) {
        label.textContent = 'Linking...';
        this._button.classList.add('dualstream-btn-loading');
        this._button.classList.remove('dualstream-btn-active');
        if (vinyl) {
          vinyl.classList.remove('dualstream-vinyl-hidden', 'dualstream-vinyl-paused');
        }
      } else {
        // Reset to idle
        if (this._allSources.length > 1) {
          label.textContent = `Link Alternate Audio (${this._allSources.length} available)`;
        } else {
          const sourceLabel = this._sourceInfo?.type === DS_CONSTANTS.SOURCE_MIXCLOUD
            ? '🎧 Mixcloud'
            : '🔊 Audio';
          label.textContent = `Link Alternate Audio (${sourceLabel})`;
        }
        this._button.classList.remove('dualstream-btn-active', 'dualstream-btn-loading');
        if (vinyl) {
          vinyl.classList.add('dualstream-vinyl-paused');
        }
        this._hidePlayerBar();
      }
    }
  },

  /**
   * Update the drift display.
   * @param {number} driftMs - Drift in milliseconds
   */
  updateDrift(driftMs) {
    if (!this._driftDisplay) return;
    const absDrift = Math.abs(driftMs);
    this._driftDisplay.textContent = DS_UTILS.formatDrift(driftMs);

    // Update drift status dot color based on magnitude
    if (this._statusDot) {
      this._statusDot.className = 'dualstream-status-dot';
      if (absDrift <= DS_CONSTANTS.DRIFT_OK) {
        this._statusDot.classList.add('dualstream-status-ok');
      } else if (absDrift <= DS_CONSTANTS.DRIFT_WARN) {
        this._statusDot.classList.add('dualstream-status-warn');
      } else {
        this._statusDot.classList.add('dualstream-status-error');
      }
    }
  },

  /**
   * Update the offset slider value.
   * @param {number} offsetMs
   */
  setOffset(offsetMs) {
    if (this._offsetSlider) {
      this._offsetSlider.value = offsetMs;
    }
    if (this._offsetLabel) {
      this._offsetLabel.textContent = `Offset: ${DS_UTILS.formatDrift(offsetMs)}`;
    }
  },

  /**
   * Get the player bar element (for mounting audio adapters).
   * @returns {HTMLElement}
   */
  getPlayerMount() {
    return this._playerBar?.querySelector('.dualstream-audio-mount') || this._playerBar;
  },

  // ─── Private Methods ───────────────────────────────────────

  /**
   * Inject the full DualStream UI into the YouTube page.
   */
  _injectUI() {
    // Remove existing UI if present (SPA navigation)
    const existing = document.getElementById(DS_CONSTANTS.CONTAINER_ID);
    if (existing) existing.remove();

    // Create main container
    this._container = document.createElement('div');
    this._container.id = DS_CONSTANTS.CONTAINER_ID;
    this._container.innerHTML = this._getTemplate();

    // Find the insertion point (ABOVE the video title area)
    this._waitForInsertionPoint().then((insertionPoint) => {
      if (insertionPoint) {
        // Insert as the FIRST child of #above-the-fold so it sits above the title
        insertionPoint.insertBefore(this._container, insertionPoint.firstChild);
      } else {
        // Fallback: prepend to primary content
        const primary = document.querySelector('#primary-inner') ||
                        document.querySelector('#primary');
        if (primary) {
          primary.insertBefore(this._container, primary.children[0]);
        }
      }

      // Cache element references
      this._button = document.getElementById(DS_CONSTANTS.BUTTON_ID);
      this._playerBar = document.getElementById(DS_CONSTANTS.PLAYER_BAR_ID);
      this._statusDot = document.getElementById(DS_CONSTANTS.STATUS_DOT_ID);
      this._driftDisplay = this._container.querySelector('.dualstream-drift-value');
      this._offsetSlider = this._container.querySelector('.dualstream-offset-slider');
      this._offsetLabel = this._container.querySelector('.dualstream-offset-label');

      // Bind events
      this._bindEvents();
    });
  },

  /**
   * Wait for YT's title area to appear.
   * @returns {Promise<HTMLElement|null>}
   */
  _waitForInsertionPoint() {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        // Try to find the area below the video title
        const target =
          document.querySelector('#above-the-fold') ||
          document.querySelector('#info-contents') ||
          document.querySelector('ytd-video-primary-info-renderer');

        if (target) {
          resolve(target);
          return;
        }

        attempts++;
        if (attempts < 20) {
          setTimeout(check, 300);
        } else {
          resolve(null);
        }
      };
      check();
    });
  },

  /**
   * Get the HTML template for the DualStream UI.
   * @returns {string}
   */
  _getTemplate() {
    return `
      <!-- DualStream Action Button -->
      <button id="${DS_CONSTANTS.BUTTON_ID}" class="dualstream-sync-btn" style="display:none;">
        <span id="${DS_CONSTANTS.STATUS_DOT_ID}" class="dualstream-status-dot dualstream-status-idle"></span>
        <span class="dualstream-btn-icon">
          <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="dualstream-vinyl dualstream-vinyl-paused" alt="DS" />
        </span>
        <span class="dualstream-btn-label">Link Alternate Audio</span>
        <span class="dualstream-btn-spinner"></span>
      </button>

      <!-- DualStream Player Bar (hidden until sync starts) -->
      <div id="${DS_CONSTANTS.PLAYER_BAR_ID}" class="dualstream-player-bar" style="display:none;">
        <div class="dualstream-player-header">
          <div class="dualstream-player-info">
            <span class="dualstream-player-title">DualStream</span>
            <span class="dualstream-drift-label">Drift:</span>
            <span class="dualstream-drift-value">0ms</span>
          </div>
          <div class="dualstream-player-actions">
            <button class="dualstream-resync-btn" title="Force re-link">⟳ Re-link</button>
            <button class="dualstream-expand-btn" title="Show controls">▾</button>
          </div>
        </div>

        <!-- Expandable controls -->
        <div class="dualstream-controls-expanded" style="display:none;">
          <div class="dualstream-control-row">
            <span class="dualstream-offset-label">Offset: 0ms</span>
            <input type="range" class="dualstream-offset-slider" 
                   min="-500" max="500" value="0" step="10">
          </div>
        </div>

        <!-- Audio player mount point -->
        <div class="dualstream-audio-mount"></div>
      </div>
    `;
  },

  /**
   * Bind UI event handlers.
   */
  _bindEvents() {
    // Sync button click
    if (this._button) {
      this._button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._onLinkClick();
      });
    }

    // Re-sync button
    const resyncBtn = this._container?.querySelector('.dualstream-resync-btn');
    if (resyncBtn) {
      resyncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._onRelinkClick();
      });
    }

    // Expand/collapse controls
    const expandBtn = this._container?.querySelector('.dualstream-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        this._expanded = !this._expanded;
        const controls = this._container.querySelector('.dualstream-controls-expanded');
        const audioMount = this._container.querySelector('.dualstream-audio-mount');
        if (controls) controls.style.display = this._expanded ? 'block' : 'none';
        if (audioMount) audioMount.style.display = this._expanded ? 'block' : 'none';
        expandBtn.textContent = this._expanded ? '▴' : '▾';
      });
    }

    // Offset slider
    if (this._offsetSlider) {
      this._offsetSlider.addEventListener('input', (e) => {
        const offsetMs = parseInt(e.target.value, 10);
        if (this._offsetLabel) {
          this._offsetLabel.textContent = `Offset: ${DS_UTILS.formatDrift(offsetMs)}`;
        }
        this._onOffsetChange(offsetMs);
      });
    }

    // Click outside to close stream picker
    document.addEventListener('click', (e) => {
      if (this._streamPicker && !this._streamPicker.contains(e.target) &&
          !this._button.contains(e.target)) {
        this.hideStreamPicker();
      }
    });
  },

  // ─── Stream Picker (Multi-Stream) ─────────────────────────

  /**
   * Show the stream picker popover.
   */
  showStreamPicker() {
    if (!this._container || this._allSources.length <= 1) return;

    // Remove existing picker
    this.hideStreamPicker();

    this._streamPicker = document.createElement('div');
    this._streamPicker.className = 'dualstream-stream-picker';

    let html = '<div class="dualstream-picker-title">Select Audio Stream</div>';

    this._allSources.forEach((source, index) => {
      const isActive = this._sourceInfo && this._sourceInfo.url === source.url &&
                       this._button?.classList.contains('dualstream-btn-active');
      const icon = source.type === DS_CONSTANTS.SOURCE_MIXCLOUD ? '🎧' : '🔊';
      const activeClass = isActive ? ' dualstream-picker-item-active' : '';
      const activeDot = isActive ? '<span class="dualstream-picker-active-dot"></span>' : '';

      html += `
        <button class="dualstream-picker-item${activeClass}" data-stream-index="${index}">
          <span class="dualstream-picker-icon">${icon}</span>
          <span class="dualstream-picker-label">${source.label || 'Stream ' + (index + 1)}</span>
          ${activeDot}
        </button>
      `;
    });

    this._streamPicker.innerHTML = html;

    // Bind stream item clicks
    this._streamPicker.querySelectorAll('.dualstream-picker-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.dataset.streamIndex, 10);
        const source = this._allSources[idx];
        if (source) {
          this._onStreamSelect(source);
        }
      });
    });

    // Position below the button
    this._container.appendChild(this._streamPicker);

    // Animate in
    requestAnimationFrame(() => {
      this._streamPicker.classList.add('dualstream-picker-visible');
    });
  },

  /**
   * Hide the stream picker popover.
   */
  hideStreamPicker() {
    if (this._streamPicker) {
      this._streamPicker.remove();
      this._streamPicker = null;
    }
  },

  /**
   * Show the player bar.
   */
  _showPlayerBar() {
    if (this._playerBar) {
      this._playerBar.style.display = 'block';
    }
  },

  /**
   * Expand the player bar to show the Mixcloud widget and controls.
   * Called automatically when linking starts.
   */
  expandPlayerBar() {
    this._expanded = true;
    if (!this._playerBar) return;
    const controls = this._container.querySelector('.dualstream-controls-expanded');
    const audioMount = this._container.querySelector('.dualstream-audio-mount');
    const expandBtn = this._container.querySelector('.dualstream-expand-btn');
    if (controls) controls.style.display = 'block';
    if (audioMount) audioMount.style.display = 'block';
    if (expandBtn) expandBtn.textContent = '▴';
  },

  /**
   * Hide the player bar.
   */
  _hidePlayerBar() {
    if (this._playerBar) {
      this._playerBar.style.display = 'none';
    }
    this._expanded = false;
  },

  /**
   * Show a temporary toast message in the player bar.
   * @param {string} message - The message to display
   * @param {number} [duration=4000] - Duration in ms before auto-dismiss
   */
  showToast(message, duration = 4000) {
    if (!this._container) return;

    // Remove existing toast if any
    const existing = this._container.querySelector('.dualstream-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'dualstream-toast';
    toast.innerHTML = `
      <span class="dualstream-toast-icon">🎧</span>
      <span class="dualstream-toast-text">${message}</span>
    `;

    // Insert at the top of the player bar
    if (this._playerBar) {
      this._playerBar.insertBefore(toast, this._playerBar.firstChild);
    } else {
      this._container.appendChild(toast);
    }

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('dualstream-toast-visible');
    });

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('dualstream-toast-visible');
      toast.classList.add('dualstream-toast-hiding');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  /**
   * Destroy the UI and clean up.
   */
  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._button = null;
    this._playerBar = null;
    this._statusDot = null;
    this._offsetSlider = null;
    this._offsetLabel = null;
    this._driftDisplay = null;
    this._expanded = false;
    this._sourceInfo = null;
    DS_UTILS.log('UI destroyed');
  },
};

if (typeof window !== 'undefined') {
  window.DSUI = DSUI;
}
