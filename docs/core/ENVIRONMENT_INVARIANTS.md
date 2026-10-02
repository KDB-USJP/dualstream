# Environment Invariants

This file stores stable operational truths that agents must reuse instead of rediscovering.

## Entry Template
- ID:
- Title:
- Status:
- Applies To:
- Trigger:
- Required Action:
- Evidence:
- Last Verified:
- Notes:

---

- ID: INV-001
- Title: Local API Bundling for Host CSP Bypass
- Status: Active
- Applies To: Chrome Extension Content Scripts (`src/lib/*`, `manifest.json`)
- Trigger: Content Security Policy (CSP) blocking external script injection on `youtube.com` and `mixcloud.com`.
- Required Action: Never load external script tags (e.g. `https://widget.mixcloud.com/media/js/widgetApi.js` or `https://www.youtube.com/iframe_api`) dynamically into host pages. Always bundle clean-room API wrappers locally in `src/lib/` and declare them in `manifest.json` `content_scripts`.
- Evidence: `src/lib/mixcloudWidget.js`, `src/lib/youtubeEmbed.js`, `manifest.json`.
- Last Verified: 2026-08-22
- Notes: Communication with embed iframes must use `postMessage` protocol.

---

- ID: INV-002
- Title: Description URL Protocol Prefix Convention (`ps://`)
- Status: Active
- Applies To: Parser modules (`src/content/parser.js`, `src/mixcloud/mc-parser.js`)
- Trigger: YouTube auto-shortens full `https://` URLs in descriptions, breaking pattern delimiters.
- Required Action: Convention requires dropping `htt` so URLs are written as `|||ps://...|||`. Parsers must always detect `ps://` or `p://` and reconstruct with `htt` prefix before URL parsing.
- Evidence: `docs/convention.md`, `src/content/parser.js:L165-168`.
- Last Verified: 2026-08-22
- Notes: Prevents delimiter destruction in YouTube UI.

---

- ID: INV-003
- Title: YouTube Video Background Volume Floor
- Status: Active
- Applies To: `src/content/sync.js`, `src/popup/popup.js`
- Trigger: Setting YouTube video element `volume = 0` (or `muted = true`) can trigger video player throttling or unwanted background tab sleep behavior in certain Chrome setups.
- Required Action: When alternate audio is linked, set YouTube video volume to a near-silent floor ($1\%$ / $0.01$) rather than $0\%$.
- Evidence: `src/content/sync.js:L40`, `src/shared/constants.js:L43`.
- Last Verified: 2026-08-22
- Notes: Configurable via settings popup but default is $1\%$.

---

- ID: INV-004
- Title: Mixcloud Widget User Gesture Requirement
- Status: Active
- Applies To: `src/content/content.js`, `src/content/players/mixcloud.js`
- Trigger: Browser autoplay policies prevent the embedded Mixcloud widget from initiating playback solely via automated programmatic calls on page load.
- Required Action: Display a visible toast prompt directing the user to click the play button on the embedded widget if playback does not automatically start.
- Evidence: `src/content/content.js:L153-155`.
- Last Verified: 2026-08-22
- Notes: Once user interacts, subsequent seeks and pauses work through API.

---

- ID: INV-005
- Title: Zero Plaintext Secrets in Chat
- Status: Active
- Applies To: All Agent Interactions, Chat outputs, Commits, Summaries
- Trigger: Secret handling, API tokens, passwords, vault credentials.
- Required Action: Never output plaintext secrets, API keys, or private tokens in chat, diffs, or summaries. Write secrets exclusively to `.vibe-vault-unlocked.json` and notify user to review the file.
- Evidence: `.agents/AGENTS.md`, `.agents/agent-base.md`.
- Last Verified: 2026-08-22
- Notes: Core security invariant across Trigram VCS.
