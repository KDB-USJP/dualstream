/**
 * DualStream — Shared Constants
 * Used across content scripts, popup, and service worker.
 */

const DS_CONSTANTS = {
  // --- Delimiter Pattern ---
  // Matches URLs wrapped in triple-pipe delimiters: |||https://example.com|||
  URL_PATTERN: /\|\|\|(.+?)\|\|\|/g,

  // --- Source Types ---
  SOURCE_MIXCLOUD: 'mixcloud',
  SOURCE_GENERIC: 'generic',

  // --- Sync States ---
  SYNC_IDLE: 'idle',
  SYNC_LOADING: 'loading',
  SYNC_BUFFERING: 'buffering',
  SYNC_SYNCING: 'syncing',
  SYNC_ERROR: 'error',
  SYNC_PAUSED: 'paused',

  // --- Drift Thresholds (ms) ---
  DRIFT_OK: 30,          // Below this: perfect, do nothing
  DRIFT_WARN: 100,       // Below this: gentle rate adjustment
  DRIFT_CRITICAL: 2000,  // Above this: likely a manual seek, hard resync

  // --- Drift Correction ---
  RATE_BOOST: 1.03,      // Slight speed up to close gap
  RATE_SLOW: 0.97,       // Slight slow down to close gap
  RATE_NORMAL: 1.0,
  CORRECTION_CHECK_MS: 200,  // How often to check drift

  // --- UI ---
  CONTAINER_ID: 'dualstream-container',
  BUTTON_ID: 'dualstream-sync-btn',
  PLAYER_BAR_ID: 'dualstream-player-bar',
  STATUS_DOT_ID: 'dualstream-status-dot',

  // --- Settings Defaults ---
  DEFAULT_SETTINGS: {
    ytVolume: 1,              // 1% — near silent but not muted
    popOutByDefault: false,
    showSyncControls: true,
    userOffset: 0,            // Manual offset in ms
    autoSync: false,
  },

  // --- Mixcloud ---
  MIXCLOUD_DOMAIN: 'mixcloud.com',
  MIXCLOUD_WIDGET_URL: 'https://widget.mixcloud.com/media/js/widgetApi.js',
  MIXCLOUD_EMBED_BASE: 'https://www.mixcloud.com/widget/iframe/',

  // --- Messages ---
  MSG_SYNC_STATUS: 'sync-status',
  MSG_GET_STATUS: 'get-status',
  MSG_UPDATE_SETTINGS: 'update-settings',
  MSG_GET_SETTINGS: 'get-settings',
  MSG_RESYNC: 'resync',
  MSG_TOGGLE_PLAY: 'toggle-play',
};

// Make available in both content script and module contexts
if (typeof window !== 'undefined') {
  window.DS_CONSTANTS = DS_CONSTANTS;
}
