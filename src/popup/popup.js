/**
 * DualStream — Popup Script
 * Manages the extension popup UI: status display, quick controls, settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── Element References ──────────────────────────────────
  const statusDot = document.getElementById('popup-status-dot');
  const statusLabel = document.getElementById('popup-status-label');
  const sourceRow = document.getElementById('popup-source');
  const sourceValue = document.getElementById('popup-source-value');
  const driftRow = document.getElementById('popup-drift-row');
  const driftValue = document.getElementById('popup-drift-value');
  const controlsSection = document.getElementById('popup-controls');
  const toggleBtn = document.getElementById('popup-toggle-btn');
  const relinkBtn = document.getElementById('popup-relink-btn');

  const ytVolumeSlider = document.getElementById('setting-yt-volume');
  const ytVolumeValue = document.getElementById('setting-yt-volume-value');
  const offsetSlider = document.getElementById('setting-offset');
  const offsetValue = document.getElementById('setting-offset-value');
  const showControlsToggle = document.getElementById('setting-show-controls');

  // ─── Load State ──────────────────────────────────────────
  loadStatus();
  loadSettings();

  // ─── Periodic Status Updates ─────────────────────────────
  const statusInterval = setInterval(loadStatus, 1000);
  window.addEventListener('unload', () => clearInterval(statusInterval));

  // ─── Event Handlers ──────────────────────────────────────
  toggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'toggle-play' });
    // Optimistic UI update
    setTimeout(loadStatus, 300);
  });

  relinkBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'resync' });
    setTimeout(loadStatus, 300);
  });

  ytVolumeSlider.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    ytVolumeValue.textContent = vol + '%';
    saveSettings({ ytVolume: vol });
  });

  offsetSlider.addEventListener('input', (e) => {
    const offset = parseInt(e.target.value, 10);
    const sign = offset >= 0 ? '+' : '';
    offsetValue.textContent = sign + offset + 'ms';
    saveSettings({ userOffset: offset });
  });

  showControlsToggle.addEventListener('change', (e) => {
    saveSettings({ showSyncControls: e.target.checked });
  });

  // ─── Functions ───────────────────────────────────────────
  function loadStatus() {
    chrome.runtime.sendMessage({ type: 'get-status' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        updateStatusDisplay('idle', 0, null, false);
        return;
      }
      updateStatusDisplay(
        response.state || 'idle',
        response.drift || 0,
        response.source || null,
        response.active || false
      );
    });
  }

  function updateStatusDisplay(state, drift, source, active) {
    // Status dot
    statusDot.className = 'ds-status-dot';
    switch (state) {
      case 'syncing':
        statusDot.classList.add('ds-active');
        statusLabel.textContent = 'Linked';
        break;
      case 'buffering':
      case 'loading':
        statusDot.classList.add('ds-warning');
        statusLabel.textContent = 'Connecting...';
        break;
      case 'error':
        statusDot.classList.add('ds-error');
        statusLabel.textContent = 'Error';
        break;
      case 'paused':
        statusDot.classList.add('ds-active');
        statusLabel.textContent = 'Paused';
        break;
      default:
        statusLabel.textContent = 'Idle';
    }

    // Source info
    if (source) {
      sourceRow.style.display = 'flex';
      const label = source.type === 'mixcloud' ? '🎧 Mixcloud' : '🔊 Audio';
      sourceValue.textContent = label;
      controlsSection.style.display = 'flex';
    } else {
      sourceRow.style.display = 'none';
      controlsSection.style.display = 'none';
    }

    // Drift
    if (active) {
      driftRow.style.display = 'flex';
      const absDrift = Math.abs(Math.round(drift));
      const sign = drift >= 0 ? '+' : '-';
      driftValue.textContent = absDrift < 1 ? '0ms' : `${sign}${absDrift}ms`;
    } else {
      driftRow.style.display = 'none';
    }

    // Toggle button text
    toggleBtn.textContent = active ? 'Unlink Audio' : 'Link Audio';
  }

  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'get-settings' }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      ytVolumeSlider.value = response.ytVolume || 1;
      ytVolumeValue.textContent = (response.ytVolume || 1) + '%';

      offsetSlider.value = response.userOffset || 0;
      const offset = response.userOffset || 0;
      const sign = offset >= 0 ? '+' : '';
      offsetValue.textContent = sign + offset + 'ms';

      showControlsToggle.checked = response.showSyncControls !== false;
    });
  }

  function saveSettings(partial) {
    chrome.runtime.sendMessage({
      type: 'update-settings',
      settings: partial,
    });
  }
});
