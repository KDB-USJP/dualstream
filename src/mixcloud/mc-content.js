/**
 * DualStream — Mixcloud Content Script (Main Orchestrator)
 *
 * Entry point for the Mixcloud-side content script.
 * Wires together parser, UI, player observer, YouTube embed,
 * PiP overlay, and sync conductor.
 */

const DualStreamMC = {
  _active: false,
  _currentSource: null,
  _playerObserver: null,
  _ytEmbed: null,

  /**
   * Boot the extension on this Mixcloud page.
   */
  async init() {
    DS_UTILS.log('Initializing DualStream (Mixcloud mode) v1.0.0');

    // Initialize the UI
    MCUI.init({
      onOpenClick: () => this._handleToggle(),
    });

    // Initialize the parser
    MCParser.init();

    // Listen for YouTube URL discoveries in description
    MCParser.onFound((source, allSources) => {
      DS_UTILS.log('MC: YouTube video URL found:', source);
      this._currentSource = source;
      MCUI.showButton(source);
    });

    MCParser.onCleared(() => {
      DS_UTILS.log('MC: No video URL on this page');
      this._cleanup();
      MCUI.hideButton();
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this._handleMessage(message, sendResponse);
      return true;
    });

    DS_UTILS.log('DualStream (Mixcloud) ready — waiting for |||youtube-url||| in description');
  },

  /**
   * Handle the open/close video toggle.
   */
  async _handleToggle() {
    DS_UTILS.log('MC: Toggle clicked, active:', this._active);
    if (this._active) {
      this._closeVideo();
    } else {
      await this._openVideo();
    }
  },

  /**
   * Open the linked YouTube video in a PiP overlay.
   */
  async _openVideo() {
    if (!this._currentSource) {
      DS_UTILS.error('MC: No video source available');
      return;
    }

    try {
      const videoId = DS_UTILS.extractYouTubeVideoId(this._currentSource.url);
      if (!videoId) {
        DS_UTILS.error('MC: Could not extract YouTube video ID from', this._currentSource.url);
        return;
      }

      DS_UTILS.log('MC: Opening video', videoId);

      // Create PiP overlay
      const videoContainer = MCPiP.init({
        onClose: () => this._closeVideo(),
        onResync: () => this._handleResync(),
      });

      // Initialize YouTube embed inside the PiP
      this._ytEmbed = Object.create(MCYouTubeEmbed);
      await this._ytEmbed.init(videoId, videoContainer);

      // Initialize the Mixcloud player observer
      this._playerObserver = Object.create(MCPlayerObserver);
      this._playerObserver.init();

      // Initialize the sync conductor
      MCSyncConductor.init(this._playerObserver, this._ytEmbed);

      // Listen for drift updates
      MCSyncConductor.onDrift((driftMs) => {
        MCPiP.updateDrift(driftMs);
      });

      // Start linked playback
      MCSyncConductor.start();

      this._active = true;
      MCUI.setActive(true);
      MCUI.showToast('Video linked — plays with your Mixcloud audio', 4000);

      DS_UTILS.log('MC: Video linked successfully');
    } catch (e) {
      DS_UTILS.error('MC: Failed to open video:', e);
      this._cleanup();
    }
  },

  /**
   * Close the video overlay.
   */
  _closeVideo() {
    DS_UTILS.log('MC: Closing video');
    MCSyncConductor.destroy();

    if (this._ytEmbed) {
      this._ytEmbed.destroy();
      this._ytEmbed = null;
    }

    if (this._playerObserver) {
      this._playerObserver.destroy();
      this._playerObserver = null;
    }

    MCPiP.destroy();

    this._active = false;
    MCUI.setActive(false);
    DS_UTILS.log('MC: Video closed');
  },

  /**
   * Handle resync request.
   */
  _handleResync() {
    if (!this._active) return;
    MCSyncConductor.resync();
  },

  /**
   * Handle messages from popup or service worker.
   */
  _handleMessage(message, sendResponse) {
    switch (message.type) {
      case DS_CONSTANTS.MSG_GET_STATUS:
        sendResponse({
          active: this._active,
          mode: 'mixcloud',
          state: MCSyncConductor.getState(),
          drift: MCSyncConductor.getCurrentDrift(),
          source: this._currentSource,
        });
        break;

      case DS_CONSTANTS.MSG_RESYNC:
        this._handleResync();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  },

  /**
   * Clean up everything.
   */
  _cleanup() {
    if (this._active) {
      this._closeVideo();
    }
    this._currentSource = null;
  },
};

// ─── Boot ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DualStreamMC.init());
} else {
  DualStreamMC.init();
}
