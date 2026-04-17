# The `|||url|||` Convention

## Overview

DualStream uses a simple text convention to link alternate audio sources to YouTube videos. Content creators place a specially-formatted URL in their video description, and viewers with DualStream installed can seamlessly play the alternate audio alongside the video.

## Format

```
|||ps://<url>|||
```

- The URL must be wrapped in exactly three pipe characters (`|||`) on each side
- **Drop the `htt` prefix** from the URL (write `ps://` instead of `https://`)
  - YouTube auto-shortens text that looks like a full URL (`https://...`), which breaks the pattern
  - DualStream automatically prepends `htt` to reconstruct the full URL
- Only one URL is needed (DualStream uses the first one found)
- Multiple URLs can be included — DualStream will use the first match

## Placement

Place the `|||url|||` anywhere in your YouTube video description. It can be:
- On its own line
- Inline with other text
- Near the top (recommended for visibility)
- At the bottom with other links

**Example description:**

```
Live DJ set recorded at Club Venue, April 2026.

Full audio stream available on Mixcloud:
|||ps://www.mixcloud.com/djartist/live-at-club-venue-april-2026/|||

Tracklist:
1. Artist - Track Name
2. Artist - Track Name
...
```

## Supported URL Types

### Mixcloud (Primary)

```
|||ps://www.mixcloud.com/artist-name/show-name/|||
```

- DualStream embeds the Mixcloud player widget directly on the YouTube page
- Play/pause/seek are all handled automatically
- The Mixcloud widget must remain visible (minimized) per Mixcloud's API requirements

### Direct Audio Files

```
|||ps://example.com/path/to/audio.mp3|||
|||ps://cdn.example.com/commentary-track.ogg|||
```

- Supports any browser-playable audio format: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.flac`, `.webm`
- Loaded via standard HTML5 `<audio>` element
- Server must support CORS headers if hosted on a different domain

## Best Practices

1. **Match durations** — The alternate audio should be approximately the same length as the video
2. **Align start points** — Both streams should start from the same logical point (e.g., the beginning of a performance)
3. **Test with DualStream** — Install the extension and verify the experience before publishing
4. **Inform your audience** — Let viewers know they need DualStream installed:
   ```
   🎧 Install DualStream (Chrome extension) to hear the full-quality audio!
   ```
5. **Keep the URL accessible** — Don't bury it in collapsed sections of the description

## Why Triple Pipes?

The `|||` delimiter was chosen because:

- **Uniqueness** — Three consecutive pipe characters almost never appear naturally in text
- **Visibility** — It's visually distinct, making it easy to spot in descriptions
- **Keyboard accessible** — The pipe `|` character is available on all standard keyboards (Shift + \\)
- **Parser-friendly** — Simple regex pattern: `\|\|\|(.+?)\|\|\|`
- **No conflicts** — Doesn't interfere with YouTube's description formatting, URLs, or hashtags

## Why `ps://` instead of `https://`?

YouTube automatically shortens any text that looks like a URL (starting with `http://` or `https://`) into a clickable link with truncated display text. This mangles the `|||url|||` pattern so DualStream can't find it.

By dropping the `htt` prefix, the text no longer triggers YouTube's URL detection, so the full `|||ps://...|||` pattern stays intact and visible in the description. DualStream automatically prepends `htt` to reconstruct the working URL.
