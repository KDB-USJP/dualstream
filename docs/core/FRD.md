# Functional Requirements Document (FRD)

## 1. Vision & Goals
**DualStream** is a lightweight, open-source Google Chrome Extension (Manifest V3) that provides synchronized, bidirectional playback linking between YouTube videos and external audio/video sources (specifically Mixcloud and direct HTML5 audio streams).

### Key Value Propositions
- **Legal & Fair Streaming**: Enables creators and DJ performers to stream visual sets on YouTube while streaming licensed music through royalty-compliant platforms like Mixcloud (e.g., Mixcloud Pro), keeping audio and video as separate independent streams without unauthorized synchronization remixing.
- **Multi-Track Commentary & Dubs**: Allows creators to offer alternate audio tracks (commentary, language dubs, music-only, high-fidelity audio) referenced directly in YouTube video descriptions.
- **Bidirectional Video PiP**: Allows Mixcloud listeners to view a floating, synchronized YouTube video overlay inside Mixcloud show pages.

---

## 2. Target Audience & Use Cases
1. **DJs & Performance Artists**: Stream visual DJ sets on YouTube with pristine, royalty-cleared audio from Mixcloud.
2. **Commentators & Educators**: Provide Rifftrax-style commentary, director's commentary, or translation tracks linked to YouTube videos.
3. **Mixcloud Listeners & Creators**: Watch visual accompaniments for Mixcloud radio shows and DJ sets in a movable Picture-in-Picture window.
4. **General Viewers**: Seamless one-click linking to high-quality or alternate audio tracks without complicated manual synchronization.

---

## 3. Core Capabilities & User Flows

### Direction 1: YouTube → Alternate Audio
1. **Description Parsing**:
   - Content creators embed one or more formatted URLs inside YouTube video descriptions using the convention: `|||ps://<url> [| Label]|||`.
   - DualStream automatically detects and parses the description on page load and SPA navigation.
2. **Action Trigger & Stream Picker**:
   - For a single stream: A `"Link Alternate Audio (🎧 Mixcloud / 🔊 Audio)"` button is injected above the video title.
   - For multiple streams: The button indicates count (`"Link Alternate Audio (N available)"`) and opens a stream selection popover when clicked.
3. **Linked Playback**:
   - Clicking link sets YouTube video volume to near-silent (1%) and mounts the alternate audio player (Mixcloud widget or generic HTML5 audio).
   - Starts audio playback seek-matched to the current YouTube playhead time.
   - Bidirectional play/pause/seek synchronization maintains drift alignment ($\le 100\text{ ms}$).
   - Mini player bar provides real-time drift display, manual millisecond offset slider ($\pm 500\text{ ms}$), and re-sync trigger.
   - Clicking `"Unlink Audio"` cleanly dismounts the alternate player and restores original YouTube volume.

### Direction 2: Mixcloud → YouTube Video Overlay
1. **Mixcloud Description Parsing**:
   - Scans Mixcloud show descriptions for `|||ps://youtu.be/<id>|||` or `|||ps://www.youtube.com/watch?v=<id>|||`.
2. **PiP Video Overlay**:
   - Displays a `"🎥 Open Linked Video"` button in the Mixcloud action bar.
   - Clicking spawns a floating, draggable, resizable (16:9 aspect locked), fullscreen-capable PiP overlay containing a muted YouTube embed.
   - Automatically tracks Mixcloud audio playhead and continuously synchronizes the YouTube video to match.

### Extension Popup & Persistent Settings
- Global settings popup allows configuring default YouTube background volume (1–100%), manual time offset ($\pm 500\text{ ms}$), and control visibility.
- Settings are synchronized across browser instances via `chrome.storage.sync`.
- Extension badge displays active sync status (`●` syncing, `…` buffering/loading, `‖` paused, `!` error).

---

## 4. Success Metrics & Non-Functional Requirements
- **Drift Tolerance**: Maintain drift under $100\text{ ms}$ during continuous playback.
- **Resource Footprint**: Minimal CPU overhead by using `requestAnimationFrame` with a 200 ms throttling accumulator.
- **Zero Host Code Alterations**: Operate strictly through client-side content scripts without requiring server-side relays or backend infrastructure.
- **Privacy & Security**: Zero secret leakage; no external tracking or unvetted analytics.
