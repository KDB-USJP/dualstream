# DualStream

**Bidirectional linked playback between YouTube and Mixcloud.**

DualStream is an open-source Chrome extension that links video and audio across platforms — keeping them tightly synchronized in time. Watch a YouTube video with alternate audio from Mixcloud, or watch a linked YouTube video while listening on Mixcloud.

## Why?

Video and audio exist as **separate, independently-licensed streams**. DualStream keeps them that way. You watch video from one source while listening to audio from another, with both streams playing in time.

Common use cases:
- 🎧 **Performance videos** — Watch a DJ set on YouTube while the properly-licensed audio plays from Mixcloud
- 🎙️ **Commentary tracks** — Add a director's commentary or alternate narration to any video
- 🌐 **Language dubs** — Listen in your language while watching the original video
- 🎵 **High-fidelity audio** — Bypass YouTube's compressed audio with a higher-quality source
- 🎥 **Video overlays** — Mixcloud creators can link a YouTube video that plays alongside their audio

## Installation

### From Source (Developer Mode)
1. Clone this repository:
   ```bash
   git clone https://github.com/KDB-USJP/dualstream.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **"Load unpacked"**
5. Select the cloned `dualstream` directory
6. The DualStream icon appears in your extensions bar ✓

## How It Works

### Direction 1: YouTube → Alternate Audio

#### For Content Creators

Add a specially-formatted URL to your YouTube video description using triple-pipe delimiters.

**Important:** Drop the `htt` from the beginning of URLs. YouTube auto-shortens links starting with `https://`, which breaks the pattern. Using `ps://` keeps the full text visible:

```
Check out the full audio on Mixcloud!
|||ps://www.mixcloud.com/artist/show-name/|||
```

DualStream will detect this URL, reconstruct the full `https://` link, and show a **"Link Alternate Audio"** button to viewers who have the extension installed.

#### Multiple Audio Streams

You can include **multiple** `|||url|||` entries in one description. When DualStream detects more than one, viewers get a **stream picker** to choose which audio to link:

```
|||ps://www.mixcloud.com/artist/english-commentary/ | English Commentary|||
|||ps://www.mixcloud.com/artist/spanish-commentary/ | Comentario en Español|||
|||ps://www.mixcloud.com/artist/music-only/|||
```

**Labeling:** Add a human-readable label after the URL with a pipe separator: `|||url | Label|||`

- Labels are optional — if omitted, DualStream auto-generates one from the URL path
- `music-only` becomes **Music Only**, `english-commentary` becomes **English Commentary**
- Viewers see labels in the stream picker, making it easy to identify each option

**Behavior:**
- **1 stream** → Direct "Link Alternate Audio" button (no picker)
- **2+ streams** → Button shows "Link Alternate Audio (N available)" → clicking opens a popover to choose
- **Switching** → Selecting a different stream seamlessly unlinks the current one and links the new one

#### For Viewers

1. Navigate to a YouTube video that contains `|||url|||` entries in its description
2. A **"🎧 Link Alternate Audio"** button appears above the video title
3. Click it — if multiple streams are available, pick one from the popover
4. DualStream will:
   - Lower the YouTube video volume to near-silent
   - Load the alternate audio source
   - Start both streams playing together, linked in time
5. Use the controls to adjust timing offset or re-link if needed
6. Click **"Unlink Audio"** to disconnect and restore normal playback

---

### Direction 2: Mixcloud → YouTube Video Overlay

#### For Mixcloud Creators

Add the same `|||url|||` pattern to your Mixcloud show description, but with a **YouTube** URL:

```
Watch the video for this session:
|||ps://youtu.be/VIDEO_ID|||
```

Viewers with DualStream installed will see a **"🎥 Open Linked Video"** button on the Mixcloud page.

#### For Viewers

1. Navigate to a Mixcloud show page that contains a `|||youtube-url|||` in its description
2. A **"🎥 Open Linked Video"** button appears on the page
3. Click it — a **Picture-in-Picture** overlay opens with the YouTube video (muted)
4. The video follows your Mixcloud audio — pause, play, and seek are synchronized
5. The PiP overlay is:
   - 📌 **Draggable** — click and drag the header bar
   - ↔️ **Resizable** — drag the bottom-right corner (locks to 16:9)
   - 🔲 **Fullscreen** — toggle fullscreen on the video
   - 📍 **Persistent** — remembers its position across sessions
6. Click **✕** to close the overlay

### Supported Sources

| Source | On YouTube | On Mixcloud | Notes |
|--------|-----------|-------------|-------|
| **Mixcloud** | ✅ Alternate audio | — | Embedded widget with play/pause/seek |
| **YouTube** | — | ✅ Video overlay | Muted PiP embed, synced to MC audio |
| **Direct audio** (.mp3, .ogg, .wav) | ✅ Alternate audio | — | Via HTML5 `<audio>` element |
| Other platforms | 🔜 Planned | 🔜 Planned | Extensible adapter architecture |

## The `|||url|||` Convention

The triple-pipe delimiter (`|||`) was chosen because:
- It's visually distinct and unlikely to appear naturally in descriptions
- It's easy to type on any keyboard
- It doesn't conflict with YouTube's markdown or link formatting
- It's grep-friendly for automated tools

**Format:**
```
|||ps://<url>|||                     ← basic (auto-generated label)
|||ps://<url> | Human-Readable Label|||   ← with explicit label
```

> **Tip:** Drop the `htt` prefix (`ps://` instead of `https://`) to prevent YouTube from auto-shortening your links. DualStream reconstructs the full URL automatically.

## Settings

Access settings via the extension popup (click the DualStream icon):

| Setting | Default | Description |
|---------|---------|-------------|
| **YT Volume** | 1% | YouTube video volume (low to avoid API pausing) |
| **Manual Offset** | 0ms | Fine-tune audio timing (±500ms) |
| **Show Controls** | On | Display offset/re-link controls on the page |

## Technical Details

- **Manifest V3** — Modern Chrome extension architecture
- **Drift correction** — `requestAnimationFrame`-based loop checks alignment every ~200ms
- **Target latency** — ≤100ms drift between video and audio
- **Correction strategy:**
  - < 30ms: Perfect, no action
  - 30–100ms: Gentle playback rate adjustment (generic audio) or micro-seek (Mixcloud)  
  - 100ms–2s: Hard seek to correct position
  - \> 2s: Full re-link (likely a manual seek)
- **YT SPA aware** — Handles YouTube's single-page-app navigation correctly
- **Bundled APIs** — Both Mixcloud Widget and YouTube IFrame APIs are bundled locally to bypass CSP restrictions on host pages
- **Mixcloud player observation** — Uses `<audio>` element detection with DOM text-polling fallback to read native player state

## Contributing

Pull requests welcome! Areas where help is appreciated:
- Additional audio source adapters (SoundCloud, Bandcamp, etc.)
- Improved drift correction algorithms
- Accessibility improvements
- Internationalization (i18n)

## License

[MIT](LICENSE) — Use it, fork it, improve it.
