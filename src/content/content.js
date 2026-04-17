/**
 * DualStream — Main Content Script
 * 
 * Entry point for the content script. Orchestrates the parser, UI,
 * player adapters, and conductor.
 */

const DualStream = {
  _active: false,
  _currentSource: null,
  _allSources: [],
  _audioAdapter: null,
  _settings: null,

  /**
   * Boot the extension on this YouTube page.
   */
  async init() {
    DS_UTILS.log('Initializing DualStream v1.0.0');

    // Load settings
    this._settings = await DS_UTILS.loadSettings();

    // Initialize the UI
    DSUI.init({
      onLinkClick: () => this._handleLinkToggle(),
      onRelinkClick: () => this._handleRelink(),
      onOffsetChange: (ms) => this._handleOffsetChange(ms),
      onStreamSelect: (source) => this._handleStreamSelect(source),
    });

    // Initialize the parser
    DSParser.init();

    // Listen for URL discoveries
    DSParser.onFound((source, allSources) => {
      DS_UTILS.log('Audio source(s) found:', allSources.length);
      this._currentSource = source;
      this._allSources = allSources;
      DSUI.show();
      DSUI.showButton(source, allSources);
    });

    // Listen for URL clearances (navigated away)
    DSParser.onCleared(() => {
      DS_UTILS.log('No audio source on this page');
      this._cleanup();
      DSUI.hide();
    });

    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this._handleMessage(message, sendResponse);
      return true; // async response
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes) => {
      this._onSettingsChanged(changes);
    });

    DS_UTILS.log('DualStream ready — waiting for |||url||| in description');
  },

  /**
   * Handle the link/unlink button toggle.
   */
  async _handleLinkToggle() {
    DS_UTILS.log('Link toggle clicked, active:', this._active);
    if (this._active) {
      await this._stopLink();
    } else {
      // If multiple streams, the UI picker handles selection
      // If single stream, link directly
      if (this._allSources.length > 1) {
        DSUI.showStreamPicker();
      } else {
        await this._startLink();
      }
    }
  },

  /**
   * Handle stream selection from the picker (multi-stream).
   * Seamlessly switches: unlinks old stream if active, links new one.
   */
  async _handleStreamSelect(source) {
    DS_UTILS.log('Stream selected:', source.label);
    DSUI.hideStreamPicker();

    // If currently linked to a different stream, unlink first
    if (this._active) {
      await this._stopLink();
    }

    // Link the selected stream
    this._currentSource = source;
    await this._startLink();
  },

  /**
   * Start linking the audio.
   */
  async _startLink() {
    if (!this._currentSource) {
      DS_UTILS.error('No audio source available');
      return;
    }

    try {
      DSUI.setState(DS_CONSTANTS.SYNC_LOADING);

      // Find the YT video element
      const video = document.querySelector('video');
      if (!video) {
        DS_UTILS.error('No video element found');
        DSUI.setState(DS_CONSTANTS.SYNC_ERROR);
        return;
      }

      // Create the appropriate audio adapter
      const mountTarget = DSUI.getPlayerMount();
      if (this._currentSource.type === DS_CONSTANTS.SOURCE_MIXCLOUD) {
        this._audioAdapter = Object.create(DSMixcloudPlayer);
        await this._audioAdapter.init(this._currentSource.url, mountTarget);
      } else {
        this._audioAdapter = Object.create(DSGenericPlayer);
        await this._audioAdapter.init(this._currentSource.url, mountTarget);
      }

      // Auto-expand the player bar so the Mixcloud widget is visible
      DSUI.expandPlayerBar();

      // Initialize the conductor
      await DSSyncConductor.init(video, this._audioAdapter, this._settings);

      // Listen for drift updates
      DSSyncConductor.onDrift((driftMs) => {
        DSUI.updateDrift(driftMs);
      });

      // Listen for state changes
      DSSyncConductor.onStateChange((state) => {
        DSUI.setState(state);
      });

      // Start the linked playback (auto-plays audio + video)
      await DSSyncConductor.start();
      this._active = true;

      // Show a toast prompting user to click play on the Mixcloud widget
      // (Mixcloud widget API doesn't support autoplay from external code)
      if (this._currentSource.type === DS_CONSTANTS.SOURCE_MIXCLOUD) {
        DSUI.showToast('Press ▶ on the Mixcloud player below to start audio', 5000);
      }

      DS_UTILS.log('Audio linked successfully');
    } catch (e) {
      DS_UTILS.error('Failed to start audio link:', e);
      DSUI.setState(DS_CONSTANTS.SYNC_ERROR);
      this._cleanup();
    }
  },

  /**
   * Stop the linked playback.
   */
  async _stopLink() {
    DS_UTILS.log('Unlinking audio — destroying conductor and adapter');
    DSSyncConductor.destroy();
    if (this._audioAdapter) {
      this._audioAdapter.destroy();
      this._audioAdapter = null;
    }
    this._active = false;
    DSUI.setState(DS_CONSTANTS.SYNC_IDLE);
    DS_UTILS.log('Audio unlinked');
  },

  /**
   * Handle re-link request.
   */
  async _handleRelink() {
    if (!this._active) return;
    await DSSyncConductor.resync();
  },

  /**
   * Handle offset change from the UI slider.
   * @param {number} ms - Offset in milliseconds
   */
  _handleOffsetChange(ms) {
    DSSyncConductor.setUserOffset(ms);
    // Persist the setting
    DS_UTILS.saveSettings({ userOffset: ms });
  },

  /**
   * Handle messages from the popup or service worker.
   * @param {object} message
   * @param {Function} sendResponse
   */
  _handleMessage(message, sendResponse) {
    switch (message.type) {
      case DS_CONSTANTS.MSG_GET_STATUS:
        sendResponse({
          active: this._active,
          state: DSSyncConductor.getState(),
          drift: DSSyncConductor.getCurrentDrift(),
          source: this._currentSource,
        });
        break;

      case DS_CONSTANTS.MSG_RESYNC:
        this._handleRelink();
        sendResponse({ ok: true });
        break;

      case DS_CONSTANTS.MSG_TOGGLE_PLAY:
        this._handleLinkToggle();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  },

  /**
   * Handle settings changes from chrome.storage.
   * @param {object} changes
   */
  _onSettingsChanged(changes) {
    if (changes.ytVolume) {
      const vol = changes.ytVolume.newValue;
      DSSyncConductor.setYtVolume(vol);
      this._settings.ytVolume = vol;
    }
    if (changes.userOffset) {
      const offset = changes.userOffset.newValue;
      DSSyncConductor.setUserOffset(offset);
      DSUI.setOffset(offset);
      this._settings.userOffset = offset;
    }
  },

  /**
   * Clean up the current session.
   */
  _cleanup() {
    if (this._active) {
      DSSyncConductor.destroy();
    }
    if (this._audioAdapter) {
      this._audioAdapter.destroy();
      this._audioAdapter = null;
    }
    this._active = false;
    this._currentSource = null;
    this._allSources = [];
  },
};

// ─── Boot ─────────────────────────────────────────────────
// Wait for the page to be ready, then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DualStream.init());
} else {
  DualStream.init();
}
