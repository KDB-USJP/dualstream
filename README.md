# DualStream

**Link YouTube video with alternate audio streams.**

DualStream is an open-source Chrome extension that lets you play an alternate audio track alongside a YouTube video — keeping them tightly linked in time. Originally designed for Mixcloud streams, it works with any direct audio URL.

## Why?

Video and audio exist as **separate, independently-licensed streams**. DualStream keeps them that way. You watch video from one source while listening to audio from another, with both streams playing in time.

Common use cases:
- 🎧 **Performance videos** — Watch a DJ set on YouTube while the properly-licensed audio plays from Mixcloud
- 🎙️ **Commentary tracks** — Add a director's commentary or alternate narration to any video
- 🌐 **Language dubs** — Listen in your language while watching the original video
- 🎵 **High-fidelity audio** — Bypass YouTube's compressed audio with a higher-quality source

## Installation

### From Source (Developer Mode)
1. Clone this repository:
   ```bash
   git clone https://github.com/dualstream/dualstream.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **"Load unpacked"**
5. Select the cloned `dualstream` directory
6. The DualStream icon appears in your extensions bar ✓

## How It Works

### For Content Creators

Add a specially-formatted URL to your YouTube video description using triple-pipe delimiters.

**Important:** Drop the `htt` from the beginning of URLs. YouTube auto-shortens links starting with `https://`, which breaks the pattern. Using `ps://` keeps the full text visible:

```
Check out the full audio on Mixcloud!
|||ps://www.mixcloud.com/artist/show-name/|||
```

DualStream will detect this URL, reconstruct the full `https://` link, and show a **"Link Alternate Audio"** button to viewers who have the extension installed.

### For Viewers

1. Navigate to a YouTube video that contains a `|||url|||` in its description
2. A **"🎧 Link Alternate Audio"** button appears below the video title
3. Click it — DualStream will:
   - Lower the YouTube video volume to near-silent
   - Load the alternate audio source
   - Start both streams playing together, linked in time
4. Use the controls to adjust timing offset or re-link if needed

### Supported Audio Sources

| Source | Status | Notes |
|--------|--------|-------|
| **Mixcloud** | ✅ Full support | Embedded widget with play/pause/seek |
| **Direct audio** (.mp3, .ogg, .wav) | ✅ Full support | Via HTML5 `<audio>` element |
| Other platforms | 🔜 Planned | Extensible adapter architecture |

## The `|||url|||` Convention

The triple-pipe delimiter (`|||`) was chosen because:
- It's visually distinct and unlikely to appear naturally in descriptions
- It's easy to type on any keyboard
- It doesn't conflict with YouTube's markdown or link formatting
- It's grep-friendly for automated tools

**Format:** `|||ps://<url>|||` (drop the `htt` prefix to avoid YT auto-shortening)

**Examples:**
```
|||ps://www.mixcloud.com/djname/set-name/|||
|||ps://example.com/audio/commentary.mp3|||
```

> See [docs/convention.md](docs/convention.md) for the full specification.

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

## Contributing

Pull requests welcome! Areas where help is appreciated:
- Additional audio source adapters (SoundCloud, Bandcamp, etc.)
- Improved drift correction algorithms
- Accessibility improvements
- Internationalization (i18n)

## License

[MIT](LICENSE) — Use it, fork it, improve it.
