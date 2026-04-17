/**
 * DualStream — Background Service Worker
 * 
 * Handles settings persistence, message routing between popup
 * and content scripts, and extension badge updates.
 */

// ─── Constants (duplicated here since service workers can't share globals easily) ──
const MSG_SYNC_STATUS = 'sync-status';
const MSG_GET_STATUS = 'get-status';
const MSG_UPDATE_SETTINGS = 'update-settings';
const MSG_GET_SETTINGS = 'get-settings';
const MSG_RESYNC = 'resync';
const MSG_TOGGLE_PLAY = 'toggle-play';

const DEFAULT_SETTINGS = {
  ytVolume: 1,
  popOutByDefault: false,
  showSyncControls: true,
  userOffset: 0,
  autoSync: false,
};

// ─── State ────────────────────────────────────────────────
let currentSyncState = 'idle';
let currentDrift = 0;

// ─── Message Handling ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MSG_SYNC_STATUS:
      // Content script is reporting its status
      currentSyncState = message.state || 'idle';
      currentDrift = message.drift || 0;
      updateBadge(currentSyncState);
      sendResponse({ ok: true });
      break;

    case MSG_GET_STATUS:
      // Popup is requesting current status — forward to content script
      forwardToActiveTab(message).then(sendResponse);
      return true; // async

    case MSG_GET_SETTINGS:
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        sendResponse(result);
      });
      return true; // async

    case MSG_UPDATE_SETTINGS:
      chrome.storage.sync.set(message.settings, () => {
        sendResponse({ ok: true });
      });
      return true; // async

    case MSG_RESYNC:
    case MSG_TOGGLE_PLAY:
      // Forward control messages to the active tab's content script
      forwardToActiveTab(message).then(sendResponse);
      return true; // async

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// ─── Badge Updates ────────────────────────────────────────
function updateBadge(state) {
  let color, text;

  switch (state) {
    case 'syncing':
      color = '#00c853';
      text = '●';
      break;
    case 'buffering':
    case 'loading':
      color = '#ffab00';
      text = '…';
      break;
    case 'error':
      color = '#ff5252';
      text = '!';
      break;
    case 'paused':
      color = '#FF6B35';
      text = '‖';
      break;
    default:
      color = '#666666';
      text = '';
  }

  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

// ─── Message Forwarding ──────────────────────────────────
async function forwardToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      return await chrome.tabs.sendMessage(tab.id, message);
    }
    return { error: 'No active tab' };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── Installation ─────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set(DEFAULT_SETTINGS);
    console.log('[DualStream] Installed — defaults set');
  }
});
