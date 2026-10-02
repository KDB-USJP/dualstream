# System Architecture (ARCHITECTURE)

## 1. High-Level Design & Component Architecture

DualStream is organized into modular subsystems adhering to Manifest V3 extension architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Extension Subsystems                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐             ┌────────────────────────────────┐  │
│  │   Extension Popup     │◄───────────►│   Background Service Worker    │  │
│  │   (popup.html / .js)  │  Messages   │   (service-worker.js)          │  │
│  └───────────────────────┘             └───────────────┬────────────────┘  │
│                                                        │                    │
│                        chrome.tabs.sendMessage         │                    │
│                        ───────────────────────────────►│                    │
│                                                        ▼                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 YouTube Content Script Subsystem                      │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────────┐  │  │
│  │  │  DSParser    ├───►│     DSUI     │◄───┤    DSSyncConductor      │  │  │
│  │  └──────────────┘    └──────────────┘    └────────────┬────────────┘  │  │
│  │                                                       │               │  │
│  │                                          ┌────────────┴────────────┐  │  │
│  │                                          ▼                         ▼  │  │
│  │                                   DSMixcloudPlayer          DSGenericPlayer  │
│  │                                   (Widget Iframe)           (<audio> tag) │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 Mixcloud Content Script Subsystem                     │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────────┐  │  │
│  │  │   MCParser   ├───►│     MCUI     │    │     MCSyncConductor     │  │  │
│  │  └──────────────┘    └──────────────┘    └──────┬───────────┬──────┘  │  │
│  │                                                 │           │         │  │
│  │                                                 ▼           ▼         │  │
│  │                                          MCPlayerObserver  MCYouTubeEmbed│
│  │                                          (DOM / Audio tag) (PiP Iframe)│
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │            Shared Utilities & Clean-Room Bundled Libraries            │  │
│  │  - DS_CONSTANTS (src/shared/constants.js)                             │  │
│  │  - DS_UTILS (src/shared/utils.js)                                     │  │
│  │  - Bundled Mixcloud Widget API (src/lib/mixcloudWidget.js)            │  │
│  │  - Bundled YouTube Embed PostMessage API (src/lib/youtubeEmbed.js)    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure & Layer Organization

```
dualstream/
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── .agents/                   # VCS governance rules, agent personas, RAG utilities
├── docs/                      # Documentation
│   ├── core/                  # Canonical documents (FRD, SPEC, ARCHITECTURE, etc.)
│   ├── pre-existing/          # Preserved pre-existing documentation
│   └── convention.md          # Guide to |||url||| formatting
├── icons/                     # Extension icons (16px, 48px, 128px)
└── src/
    ├── background/
    │   └── service-worker.js  # Settings persistence, badge updates, message router
    ├── content/               # YouTube-side content scripts
    │   ├── content.css        # Styling for YT-side button, player bar, toasts
    │   ├── content.js         # Top-level coordinator for YouTube
    │   ├── parser.js          # Description parser & SPA listener
    │   ├── sync.js            # Sync conductor with drift correction loop
    │   ├── ui.js              # UI injection & DOM management
    │   └── players/
    │       ├── generic.js     # HTML5 direct audio adapter
    │       ├── mixcloud.js    # Mixcloud widget adapter
    │       └── mixcloud-frame.html # Web accessible frame asset
    ├── lib/
    │   ├── mixcloudWidget.js  # Clean-room Mixcloud PlayerWidget client
    │   └── youtubeEmbed.js    # Clean-room YouTube postMessage client
    ├── mixcloud/              # Mixcloud-side content scripts
    │   ├── mc-content.css     # Styling for Mixcloud button, PiP overlay
    │   ├── mc-content.js      # Top-level coordinator for Mixcloud
    │   ├── mc-parser.js       # Description parser for Mixcloud
    │   ├── mc-pip.js          # Picture-in-Picture draggable/resizable modal
    │   ├── mc-player-observer.js # Native player state reader (DOM / audio element)
    │   ├── mc-sync.js         # Reverse sync conductor (MC audio -> YT video)
    │   ├── mc-ui.js           # Mixcloud action button injection
    │   └── mc-youtube-embed.js# YouTube embed controller
    ├── popup/
    │   ├── popup.css          # Extension popup styles
    │   ├── popup.html         # Extension popup HTML markup
    │   └── popup.js           # Popup settings and state polling logic
    └── shared/
        ├── constants.js       # Global constants, selectors, message types
        └── utils.js           # Shared helper functions, URL parsers, storage helpers
```

---

## 3. Data Flow & Execution Lifecycles

### YouTube Context Lifecycle
1. Content script initializes on YouTube watch page (`run_at: document_idle`).
2. `DSParser` waits for `#description` element, extracts text, searches for `|||...|||`.
3. If matches found, `DSUI.showButton()` renders the trigger button above video title.
4. User clicks link:
   - `DualStream` instantiates adapter (`DSMixcloudPlayer` or `DSGenericPlayer`) mounted in `DSUI.getPlayerMount()`.
   - `DSSyncConductor.init()` binds video element and audio adapter, sets YT video volume to $1\%$.
   - Conductor initiates playback, aligns playheads, and kicks off the `_driftLoop()` via `requestAnimationFrame`.
5. Drift loop calculates delta every $200\text{ ms}$:
   $$\text{Drift} = (T_{\text{video}} + T_{\text{userOffset}} - T_{\text{audio}}) \times 1000\text{ ms}$$
6. Adjustments (rate correction or seeking) are executed transparently.

### Mixcloud Context Lifecycle
1. Content script boots on `https://www.mixcloud.com/*`.
2. `MCParser` checks show descriptions for `|||...youtube...|||` patterns.
3. User clicks `"🎥 Open Linked Video"`:
   - `MCPiP` mounts floating container.
   - `MCYouTubeEmbed` injects YouTube iframe inside PiP.
   - `MCPlayerObserver` hooks into the active Mixcloud stream.
   - `MCSyncConductor` aligns YouTube video playback with Mixcloud audio.

---

## 4. Technology Stack & Environment Details
- **Platform**: Google Chrome Extension (Manifest V3, Chromium 88+)
- **Runtime**: Native Browser Vanilla ES6+ JavaScript, CSS3, HTML5
- **Build System**: Zero-build direct source packaging (no Webpack/Vite required; plain JS modules/content script arrays)
- **APIs**:
  - `chrome.storage.sync` (persistent user settings)
  - `chrome.storage.local` (PiP window coordinates and dimensions)
  - `chrome.runtime` (bidirectional messaging & badge management)
  - HTML5 Video / Audio APIs
  - DOM MutationObserver API & `requestAnimationFrame`
