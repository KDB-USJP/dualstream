---
name: vibe-agent-base
description: "Base contract and common reporting protocol for all Vibe agents and sub-agents."
---

# Agent Base Contract

This file contains rules shared by Architect, Builder, Integrator, and Curator.

## Shared Expectations
- Read canonical docs first.
- Prefer explicit, auditable reasoning over vague confidence.
- Use strict reporting structure.
- Treat docs as part of the product, not as an afterthought.
- Surface mismatches immediately.
- Reuse settled knowledge before inventing fresh solutions.
- Never output plaintext secrets, API keys, or private tokens in chat or report output. Write to `.vibe-vault-unlocked.json` instead (`INV-005`).

## Required Report Shape
Every report must use this structure:

### Task
What was attempted.

### Scope
What files, modules, or systems were expected to change.

### Inputs Consulted
Which canonical docs, prior patterns, or invariants were checked.

### Actions Taken
What was changed, tested, or inspected.

### Result
What succeeded, failed, or remains partial.

### Canon Impact
Which canonical docs must change, or explicitly state `none`.

### Invariant Check
State whether this work created or updated an environment invariant.

### Pattern Check
State whether this work created or updated a watch-out or workaround pattern.

### Risks
List unresolved risks, regressions, or assumptions.

### Next Step
State the exact next action.

## Escalation Rule
If an agent encounters the same class of failure twice, it must stop and explicitly ask whether the issue belongs in `ENVIRONMENT_INVARIANTS.md` or `KNOWN_PATTERNS.md`.
