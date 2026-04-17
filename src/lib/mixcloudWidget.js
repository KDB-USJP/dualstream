/**
 * DualStream — Bundled Mixcloud Widget API
 * 
 * This is a clean-room implementation of the Mixcloud PlayerWidget API,
 * based on the public protocol documented at https://www.mixcloud.com/developers/widget/
 * 
 * Bundled locally to avoid CSP violations when loaded as a Chrome extension
 * content script (external scripts cannot be injected into YouTube's page).
 * 
 * Provides: window.Mixcloud.PlayerWidget(iframeElement)
 */

(function (global) {
  'use strict';

  const WIDGET_ORIGIN = 'https://player-widget.mixcloud.com';

  /**
   * Simple deferred promise.
   */
  class Deferred extends Promise {
    constructor() {
      const bag = {};
      super((resolve) => { bag.resolve = resolve; });
      this._resolve = bag.resolve;
    }
    static get [Symbol.species]() { return Promise; }
    resolve(value) { this._resolve(value); }
  }

  /**
   * Create callback registry (on/off pattern).
   */
  function createCallbacks() {
    let listeners = [];
    return {
      apply(ctx, args) {
        listeners.forEach((fn) => fn.apply(ctx, args));
      },
      external: {
        on(fn) { listeners.push(fn); },
        off(fn) { listeners = listeners.filter((l) => l !== fn); },
      },
    };
  }

  /**
   * PlayerWidget — controls a Mixcloud embed iframe via postMessage.
   */
  class PlayerWidgetInternal {
    constructor(iframeEl) {
      this.iframe = iframeEl.contentWindow;
      this.methodCounter = 0;
      this.methodResponses = {};
      this.eventHandlers = {};

      this.external = {
        ready: new Deferred(),
        events: {},
      };

      this._onMessage = this._handleMessage.bind(this);
      window.addEventListener('message', this._onMessage, false);

      // Request the API surface from the widget
      this._send({ type: 'getApi' });
    }

    _send(data) {
      try {
        this.iframe.postMessage(JSON.stringify(data), '*');
      } catch (e) {
        // iframe may not be ready yet
      }
    }

    _handleMessage(event) {
      // Accept messages from Mixcloud's widget origin
      if (event.source !== this.iframe) return;

      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (parsed.mixcloud !== 'playerWidget') return;

      const { type, data } = parsed;

      switch (type) {
        case 'ready':
          this._send({ type: 'getApi' });
          break;

        case 'api':
          this._buildApi(data);
          break;

        case 'event':
          if (this.eventHandlers[data.eventName]) {
            this.eventHandlers[data.eventName].apply(this.external, data.args);
          }
          break;

        case 'methodResponse':
          if (this.methodResponses[data.methodId]) {
            this.methodResponses[data.methodId].resolve(data.value);
            delete this.methodResponses[data.methodId];
          }
          break;
      }
    }

    _buildApi({ methods, events }) {
      // Build method proxies (play, pause, seek, getPosition, etc.)
      methods.forEach((name) => {
        this.external[name] = (...args) => {
          this.methodCounter++;
          const id = this.methodCounter;
          let resolve;
          const promise = new Promise((r) => { resolve = r; });
          promise.resolve = resolve;
          this.methodResponses[id] = promise;
          this._send({
            type: 'method',
            data: { methodId: id, methodName: name, args },
          });
          return promise;
        };
      });

      // Build event emitters (progress, play, pause, etc.)
      events.forEach((name) => {
        const cb = createCallbacks();
        this.eventHandlers[name] = cb;
        this.external.events[name] = cb.external;
      });

      // Resolve the ready promise
      this.external.ready.resolve(this.external);
    }
  }

  // Expose on window.Mixcloud
  global.Mixcloud = global.Mixcloud || {};
  global.Mixcloud.PlayerWidget = function (iframeEl) {
    return new PlayerWidgetInternal(iframeEl).external;
  };
  global.Mixcloud.noConflict = function (fn) {
    fn(global.Mixcloud);
  };

})(typeof window !== 'undefined' ? window : this);
