# Technical Specification (SPEC)

## 1. System Overview
DualStream is implemented as a Chrome Extension built on Manifest V3. It operates through isolated content scripts injected into YouTube (`https://www.youtube.com/watch*`) and Mixcloud (`https://www.mixcloud.com/*`), orchestrated via a background service worker (`service-worker.js`) and configured via a browser action popup (`popup.html` / `popup.js`).

---

## 2. Protocol & Syntax Specifications

### The `|||url|||` Delimiter Protocol
- **Delimited Regex**: `/\|\|\|(.+?)\|\|\|/g`
- **Prefix Rule**: Content creators write `ps://` or `p://` instead of `https://` or `http://` to prevent YouTube's description parser from automatically auto-shortening URL text into hyperlinked strings.
- **URL Reconstruction**: DualStream detects leading `ps://` or `p://` and prepends `htt` to reconstruct the canonical URL before classification.
- **Label Extension Syntax**: `|||<url> | <Human Readable Label>|||`
  - Separated by the last standalone `' | '` occurrence.
  - If no explicit label is given, the label is inferred from the last URL pathname segment (converted from kebab/snake case to Title Case).

---

## 3. Data Models & Constants

### Supported Source Classifications
| Source Identifier | Matching Hostnames / Formats | Mount Adapter |
|---|---|---|
| `mixcloud` | `mixcloud.com`, `www.mixcloud.com` | `DSMixcloudPlayer` (bundled Mixcloud Widget API) |
| `youtube` | `youtube.com`, `youtu.be`, `www.youtube.com` | `MCYouTubeEmbed` (bundled YouTube IFrame API) |
| `generic` | Direct audio URLs (`.mp3`, `.ogg`, `.wav`, `.m4a`, `.flac`, `.webm`) | `DSGenericPlayer` (HTML5 `<audio>` element) |

### Sync States (`DS_CONSTANTS`)
- `idle`: No active linked stream.
- `loading`: Initializing widget/player adapter.
- `buffering`: Seeking and waiting for stream buffering to settle.
- `syncing`: Active synchronized playback loop running.
- `paused`: Video or audio paused; partner player held in sync.
- `error`: Failed adapter mount, CSP failure, or network load error.

### Drift Thresholds & Tuning Parameters
| Constant | Value | Behavior Description |
|---|---|---|
| `DRIFT_OK` | $30\text{ ms}$ | Drift within acceptable jitter tolerance; maintain normal rate ($1.0\times$). |
| `DRIFT_WARN` | $100\text{ ms}$ | Mild drift. Generic audio: rate adjust ($1.03\times$ or $0.97\times$). Mixcloud: micro-seek. |
| `DRIFT_CRITICAL` | $2000\text{ ms}$ | Severe drift / manual user seek. Executes hard seek to synchronized playhead. |
| `CORRECTION_CHECK_MS` | $200\text{ ms}$ | Sampling interval inside `requestAnimationFrame` loop. |
| `RATE_BOOST` / `RATE_SLOW` | $1.03\times$ / $0.97\times$ | Playback rate delta for smooth audio catching up or slowing down. |

---

## 4. Message Passing Schema (`chrome.runtime`)

| Message `type` | Payload | Direction | Description |
|---|---|---|---|
| `sync-status` | `{ state: string, drift: number }` | Content $\rightarrow$ Background | Reports current playback state to update badge. |
| `get-status` | `{}` | Popup $\rightarrow$ Content (via SW) | Queries active status, state, drift, and current source. |
| `get-settings` | `{}` | Popup $\rightarrow$ Background | Retrieves stored settings from `chrome.storage.sync`. |
| `update-settings` | `{ settings: object }` | Popup $\rightarrow$ Background / Storage | Updates settings dictionary in `chrome.storage.sync`. |
| `resync` | `{}` | Popup $\rightarrow$ Content (via SW) | Forces hard seek alignment. |
| `toggle-play` | `{}` | Popup $\rightarrow$ Content (via SW) | Toggles active link state or play/pause state. |

---

## 5. Component Interfaces & Adapters

### Audio Adapter Interface (`DSMixcloudPlayer`, `DSGenericPlayer`)
All audio player adapters implement a uniform contract:
```javascript
{
  init(url: string, mountTarget: HTMLElement): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(seconds: number): Promise<boolean>;
  getPosition(precise?: boolean): Promise<number> | number;
  getDuration(): Promise<number>;
  isPaused(): Promise<boolean> | boolean;
  setPlaybackRate(rate: number): void;
  supportsPlaybackRate(): boolean;
  onProgress(callback: (pos: number, dur: number) => void): void;
  onStateChange(callback: (state: string) => void): void;
  show(): void;
  minimize(): void;
  destroy(): void;
}
```

### Mixcloud Page Player Observer (`MCPlayerObserver`)
Monitors native Mixcloud web player via a hybrid strategy:
1. Direct `<audio>` element tracking if discovered in DOM.
2. DOM polling interval ($200\text{ ms}$) extracting time strings (e.g. `01:23 / 45:00`) from `DS_CONSTANTS.MC_PLAYER_BAR_SELECTORS`.
3. `MutationObserver` on play/pause button state and SVG icon shapes.

---

## 6. Edge Cases & Constraints
- **YouTube SPA Navigation**: Handled by listening to `yt-navigate-finish` and MutationObserver on URL changes, resetting parser and conductor lifecycle.
- **Autoplay Gesture Restriction (Mixcloud)**: Mixcloud widget forbids programmatic autoplay without user interaction. DualStream raises a toast notification prompting user to press ▶ on widget.
- **Feedback Loop Prevention**: Conductor uses `_suppressEvents` boolean flag with a debounce window ($100\text{--}200\text{ ms}$) to prevent reciprocal play/pause event ping-pong between video and audio players.
- **YouTube Mute vs Near-Silent**: Muting YouTube video ($0\text{ volume}$) can cause YouTube to pause or throttle player frames in certain background tab configurations. DualStream sets volume to $1\%$ ($0.01$) rather than muting.
- **Content Security Policy (CSP)**: Host pages forbid loading external `<script>` files; all APIs (`mixcloudWidget.js`, `youtubeEmbed.js`) are bundled locally and communicate via `window.postMessage`.
