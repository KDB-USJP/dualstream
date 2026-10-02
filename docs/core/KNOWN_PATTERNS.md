# Known Patterns and Watch-Outs

This file stores recurring traps, clever fixes, and non-obvious workarounds that should be reused instead of rediscovered.

## Entry Template
- ID:
- Title:
- Status:
- Platforms:
- Symptom:
- Root Cause or Suspected Cause:
- Confirmed Workaround or Fix:
- Where Applied:
- What To Check Next Time:
- Related Files / Commits:
- Last Verified:

---

- ID: PAT-001
- Title: Play/Pause Event Loop Suppression in Bidirectional Sync
- Status: Active
- Platforms: Chromium / All content scripts
- Symptom: Infinite ping-pong recursion of play/pause events between video player and audio player leading to stutter or UI freezing.
- Root Cause or Suspected Cause: Video `play`/`pause` handler triggers audio `play`/`pause`, which in turn fires audio event handlers that trigger video `play`/`pause`.
- Confirmed Workaround or Fix: Use a boolean flag `_suppressEvents = true` with a brief timeout window ($100\text{--}200\text{ ms}$) during programmatic state synchronization to ignore echo events.
- Where Applied: `src/content/sync.js:L306-365`, `src/mixcloud/mc-sync.js:L31-50`.
- What To Check Next Time: Check if any new player adapter triggers sync callbacks during programmatic seek/play/pause calls.
- Related Files / Commits: `src/content/sync.js`, `src/mixcloud/mc-sync.js`
- Last Verified: 2026-08-22

---

- ID: PAT-002
- Title: Mixcloud Page Player State Extraction via Multi-Selector DOM Polling + `<audio>` Tag Observer
- Status: Active
- Platforms: Mixcloud web application
- Symptom: Inability to reliably detect track time or playhead on Mixcloud when DOM classes change across React releases.
- Root Cause or Suspected Cause: Mixcloud uses obfuscated/changing CSS class names and does not provide an open global JavaScript API on their web pages.
- Confirmed Workaround or Fix: Hybrid detection strategy:
  1. Inspect DOM for hidden `<audio>` element to read `currentTime` directly;
  2. Fall back to polling text matching time regex (`MM:SS / MM:SS`) across an array of resilient fallback selectors (`MC_PLAYER_BAR_SELECTORS`);
  3. Observe play/pause button SVG path geometry (triangle vs parallel bars) via `MutationObserver`.
- Where Applied: `src/mixcloud/mc-player-observer.js`.
- What To Check Next Time: If Mixcloud updates player UI structure, verify selector array and SVG shape checks.
- Related Files / Commits: `src/mixcloud/mc-player-observer.js`, `src/shared/constants.js`
- Last Verified: 2026-08-22

---

- ID: PAT-003
- Title: YouTube Single-Page-App (SPA) Navigation Lifecycle Handling
- Status: Active
- Platforms: YouTube watch pages
- Symptom: Extension UI or sync engine remains bound to previous video after clicking a recommended video without a full page reload.
- Root Cause or Suspected Cause: YouTube navigates using client-side pushState / custom custom elements without page reloads.
- Confirmed Workaround or Fix: Listen to YouTube's native `yt-navigate-finish` and `yt-page-data-updated` events supplemented with `popstate` and a 1s lightweight URL check. Avoid subtree MutationObservers on `document.body`. Reset and cleanly destroy previous conductor/player instances before querying the new description element with a retry poll.
- Where Applied: `src/content/parser.js`, `src/content/content.js`.
- What To Check Next Time: Ensure `destroy()` cleans up interval IDs, navigation event listeners, audio instances, and DOM nodes to prevent memory leaks across navigations.
- Related Files / Commits: `src/content/parser.js`, `src/content/sync.js`, `src/content/ui.js`
- Last Verified: 2026-10-01

---

- ID: PAT-004
- Title: Adaptive Background Tab Drift Timer vs requestAnimationFrame Throttling
- Status: Active
- Platforms: Chromium (MV3 Content Scripts)
- Symptom: Audio and video drift out of sync when the YouTube or Mixcloud tab is backgrounded or minimized.
- Root Cause or Suspected Cause: Chromium throttles or suspends `requestAnimationFrame` when a tab is inactive or hidden in the background, pausing drift correction.
- Confirmed Workaround or Fix: Use an adaptive self-scheduling timer (`setTimeout`) that continues running in background tabs, with dynamic cadence (150ms during active drift correction, 250ms when synchronized) to minimize CPU usage while guaranteeing drift alignment.
- Where Applied: `src/content/sync.js`, `src/mixcloud/mc-sync.js`.
- What To Check Next Time: Ensure `_timerId` is tracked and cleared on `stop()` and `destroy()`.
- Related Files / Commits: `src/content/sync.js`, `src/mixcloud/mc-sync.js`
- Last Verified: 2026-10-01
