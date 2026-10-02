# AGENTS — Project Governance Contract

This file defines the operating contract for all agents working on this project.

## Project Intent
**See the appended `## Injected Context (Vibe)` section at the bottom of this document.**

## Current Phase
<!-- Update as the project progresses -->
- _Define current development phase and priorities._

## Canonical Documents
These files are the source of truth unless explicitly superseded in `DOC_INDEX.md`:
- `docs/core/FRD.md`
- `docs/core/SPEC.md`
- `docs/core/ARCHITECTURE.md`
- `AGENTS.md`
- `docs/core/DOC_INDEX.md`
- `docs/core/ENVIRONMENT_INVARIANTS.md`
- `docs/core/KNOWN_PATTERNS.md`

If two documents disagree, agents must stop and ask the Curator to reconcile canon before proceeding.

## Core Rules
- Preserve the user flow defined in `FRD.md` and `SPEC.md`.
- Prefer small, testable, reviewable increments.
- Do not invent features, APIs, screens, or product promises.
- Do not treat stale docs as valid merely because they exist.
- Every meaningful change must leave a documentation trail.
- Every solved recurring issue must be evaluated for permanent memory.
- **Zero Plaintext Secrets in Chat (INV-005)**: Never output plaintext secrets, API keys, private passwords, or tokens in chat responses, thoughts, or public summaries. Write secrets exclusively to the local `.vibe-vault-unlocked.json` file and notify the user to inspect the file directly.

## Operating Sequence
1. Read the canonical docs listed in `DOC_INDEX.md`.
2. Confirm task scope and affected layers.
3. Check `ENVIRONMENT_INVARIANTS.md` and `KNOWN_PATTERNS.md` before implementation.
4. If canon is missing or contradictory, escalate before coding.
5. Work in a small bounded chunk.
6. Emit a structured report.
7. Curator reconciles docs.
8. Only then is the task ready for commit or handoff.

## Reporting Cadence
Curator reporting is mandatory:
- after every 3 to 5 non-trivial commands,
- after any build or test result,
- after any scope change,
- after any discovered workaround or recurring bug,
- before every commit,
- after every commit.

## Commit Gate
No commit is complete until all of the following are true:
- the code change is summarized,
- affected canonical docs are updated or explicitly marked unchanged,
- user-facing changes, new commands, or UI actions are updated in `README.md` (both English and Japanese sections) or explicitly confirmed unaffected,
- new invariants are recorded or ruled out,
- new watch-outs are recorded or ruled out,
- unresolved risks are logged,
- the Curator has produced a commit report.

## Agent Roles
- Architect owns product and technical design decisions.
- Builder owns application code and implementation increments.
- Integrator owns external services, adapters, and end-to-end integration behavior.
- Curator owns canonical documentation, recurring knowledge capture, and change narrative.

## Stop Conditions
Agents must stop and escalate when:
- canonical docs conflict,
- a workaround changes user-visible behavior,
- a fix depends on undocumented environment assumptions,
- the same failure loop appears more than once,
- a new pattern may recur in another platform or port.

## Memory Bank & Encrypted Vault Skills
- **Querying**: Agents can query the project's semantic database at any time by running `node .agents/vibe-query.js "your search term"` in the terminal. Use this to pull historical context, plans, or guidelines.
- **Encrypted Secrets**: The `.vibe-rag.json` database may contain sensitive encrypted Scratch Notes (e.g., API keys, passwords). **NEVER** try to read `.vibe-rag.json` directly to find a secret, as you will only see ciphertext. Instead:
  1. **First, check if `.vibe-vault-unlocked.json` exists** in the root workspace. If it does, you can read it directly for instant access to all plaintext secrets!
- **Zero-Secret Chat Leak Invariant (INV-005)**: Agents must NEVER output plaintext secrets, raw keys, tokens, or passwords into chat responses, markdown diffs, or summaries (preventing external LLM logging/telemetry leaks). If an agent retrieves, creates, or decrypts a secret, it must write/update the secret solely inside the local Git-ignored `.vibe-vault-unlocked.json` and report to the user: *"Secret updated in .vibe-vault-unlocked.json. Please review the file directly."*
- **Ingesting**: Agents can update the semantic database and file tracker at any time by running `node .agents/vibe-sync.js` (or following the `vibe-ingest` skill). This should be done periodically to maintain an up-to-date context of the workspace. **IMPORTANT**: Before performing an ingest/sync operation, agents MUST ask the user to commit their changes to Git (or verify working tree is clean) to ensure a safe fallback point exists.


## Injected Context (Vibe)
### Concept
Existing codebase transitioned to Trigram VCS.

### Target Systems & Tech
Refer to existing source files and documentation in docs/pre-existing/.

### Non-Negotiables
Preserve existing architecture and functionality while adhering to the 3-phase governed VCS workflow.

### Fungible Ideas
Refactor and optimize code as specifications are authored in docs/core/.
