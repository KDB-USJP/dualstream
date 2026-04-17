/**
 * DualStream — Bundled YouTube IFrame Player API
 *
 * Clean-room implementation of YouTube's IFrame Player postMessage protocol.
 * Bundled locally to avoid CSP issues when loaded as a content script on
 * Mixcloud pages (external scripts can't be injected due to page CSP).
 *
 * Protocol reference: The YT embed iframe accepts JSON commands via postMessage
 * and responds with JSON event messages.
 *
 * Provides: window.DSYouTubePlayer(iframeElement)
 */

(function (global) {
  'use strict';

  const YT_ORIGIN = 'https://www.youtube.com';

  /**
   * YouTube player states (mirrors YT.PlayerState).
   */
  const PlayerState = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  };

  /**
   * DSYouTubePlayer — controls a YouTube embed iframe via postMessage.
   */
  class DSYouTubePlayerInternal {
    constructor(iframeEl) {
      this.iframe = iframeEl;
      this.ready = false;
      this.playerState = PlayerState.UNSTARTED;
      this.currentTime = 0;
      this.duration = 0;
      this.volume = 0;
      this.muted = true;

      this._readyCallbacks = [];
      this._stateCallbacks = [];
      this._timeUpdateInterval = null;

      this._onMessage = this._handleMessage.bind(this);
      window.addEventListener('message', this._onMessage, false);

      // Tell the iframe to start sending events
      this._waitForIframe();
    }

    /**
     * Wait for iframe to load, then start listening for events.
     */
    _waitForIframe() {
      const tryInit = () => {
        this._send({
          event: 'listening',
          id: 1,
          channel: 'dualstream',
        });
        // Also request current info
        this._send({ event: 'command', func: 'addEventListener', args: ['onReady'] });
        this._send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] });
      };

      if (this.iframe.contentWindow) {
        // Give the embed a moment to initialize
        setTimeout(tryInit, 500);
        // Retry a few times in case the embed loads slowly
        setTimeout(tryInit, 1500);
        setTimeout(tryInit, 3000);
      }

      this.iframe.addEventListener('load', () => {
        setTimeout(tryInit, 500);
      });
    }

    /**
     * Send a postMessage to the YouTube iframe.
     */
    _send(data) {
      try {
        if (this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage(JSON.stringify(data), YT_ORIGIN);
        }
      } catch (e) {
        // iframe may not be ready
      }
    }

    /**
     * Handle incoming messages from the YouTube iframe.
     */
    _handleMessage(event) {
      if (event.origin !== YT_ORIGIN) return;
      if (event.source !== this.iframe.contentWindow) return;

      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!parsed || !parsed.event) return;

      switch (parsed.event) {
        case 'onReady':
          this.ready = true;
          this._readyCallbacks.forEach((cb) => cb());
          this._readyCallbacks = [];
          // Start polling for time updates
          this._startTimePolling();
          break;

        case 'onStateChange':
          this.playerState = parsed.info;
          this._stateCallbacks.forEach((cb) => cb(parsed.info));
          break;

        case 'initialDelivery':
        case 'infoDelivery':
          if (parsed.info) {
            if (typeof parsed.info.currentTime === 'number') {
              this.currentTime = parsed.info.currentTime;
            }
            if (typeof parsed.info.duration === 'number') {
              this.duration = parsed.info.duration;
            }
            if (typeof parsed.info.volume === 'number') {
              this.volume = parsed.info.volume;
            }
            if (typeof parsed.info.muted === 'boolean') {
              this.muted = parsed.info.muted;
            }
            if (typeof parsed.info.playerState === 'number') {
              if (this.playerState !== parsed.info.playerState) {
                this.playerState = parsed.info.playerState;
                this._stateCallbacks.forEach((cb) => cb(parsed.info.playerState));
              }
            }

            // Detect ready from initial delivery if onReady didn't fire
            if (!this.ready && parsed.info.duration > 0) {
              this.ready = true;
              this._readyCallbacks.forEach((cb) => cb());
              this._readyCallbacks = [];
              this._startTimePolling();
            }
          }
          break;
      }
    }

    /**
     * Poll the iframe for current time at regular intervals.
     */
    _startTimePolling() {
      if (this._timeUpdateInterval) return;
      this._timeUpdateInterval = setInterval(() => {
        // YouTube sends infoDelivery automatically when playing,
        // but we request explicitly as backup
        this._send({ event: 'command', func: 'getVideoData', args: [] });
      }, 500);
    }

    // ─── Public API ───────────────────────────────────────────

    /**
     * Register a callback for when the player is ready.
     */
    onReady(callback) {
      if (this.ready) {
        callback();
      } else {
        this._readyCallbacks.push(callback);
      }
    }

    /**
     * Register a callback for state changes.
     */
    onStateChange(callback) {
      this._stateCallbacks.push(callback);
    }

    /**
     * Play the video.
     */
    play() {
      this._send({ event: 'command', func: 'playVideo', args: [] });
    }

    /**
     * Pause the video.
     */
    pause() {
      this._send({ event: 'command', func: 'pauseVideo', args: [] });
    }

    /**
     * Seek to a position in seconds.
     */
    seek(seconds) {
      this._send({ event: 'command', func: 'seekTo', args: [seconds, true] });
    }

    /**
     * Mute the video.
     */
    mute() {
      this._send({ event: 'command', func: 'mute', args: [] });
    }

    /**
     * Unmute the video.
     */
    unmute() {
      this._send({ event: 'command', func: 'unMute', args: [] });
    }

    /**
     * Set volume (0–100).
     */
    setVolume(vol) {
      this._send({ event: 'command', func: 'setVolume', args: [vol] });
    }

    /**
     * Get the current playback position (cached from infoDelivery).
     */
    getPosition() {
      return this.currentTime;
    }

    /**
     * Get the video duration (cached from infoDelivery).
     */
    getDuration() {
      return this.duration;
    }

    /**
     * Check if the player is paused.
     */
    isPaused() {
      return this.playerState !== PlayerState.PLAYING &&
             this.playerState !== PlayerState.BUFFERING;
    }

    /**
     * Check if the player is playing.
     */
    isPlaying() {
      return this.playerState === PlayerState.PLAYING;
    }

    /**
     * Destroy the player and clean up.
     */
    destroy() {
      window.removeEventListener('message', this._onMessage, false);
      if (this._timeUpdateInterval) {
        clearInterval(this._timeUpdateInterval);
        this._timeUpdateInterval = null;
      }
      this._readyCallbacks = [];
      this._stateCallbacks = [];
    }
  }

  // Expose on window
  global.DSYouTubePlayer = function (iframeEl) {
    return new DSYouTubePlayerInternal(iframeEl);
  };
  global.DSYouTubePlayer.PlayerState = PlayerState;

})(typeof window !== 'undefined' ? window : this);
