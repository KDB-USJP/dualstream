---
name: vibe-ingest
description: Autonomous agent skill to index, semantically tag, and track dependencies of workspace files into the local RAG DB.
---

# Vibe Ingestion Protocol

When the user asks you to "run vibe-ingest", "index the workspace", or "/goal index the codebase", follow this protocol to ensure 100% exhaustive codebase coverage without skipping files.

## Instant Sync via CLI (Recommended)
Run the permanent workspace indexing utility:
```bash
node .agents/vibe-sync.js
```
This automatically:
- Scans all workspace files (respecting `.gitignore`, `node_modules`, `out`, and binary files).
- Preserves all custom user scratch notes and encrypted vault secrets.
- Generates `.vibe-tracker.md` and `.vibe-rag.json`.

---

## Manual Agentic Deep Crawl (Optional for Deep Semantic Tagging)
If deeper file-by-file context enrichment is required:

## Phase 3: Exhaustive Execution Loop
Process the checklist strictly directory by directory. For each file:
1. Read its contents.
2. In your context window, generate:
   - A 1-2 sentence `summary` describing its core purpose.
   - An array of semantic `tags` (e.g., `['architecture', 'auth']`).
   - A `dependsOn` array containing paths of other files this file explicitly imports or requires.
3. Append or update the entry in `.vibe-rag.json`. The schema must exactly match:
   ```json
   {
     "id": "relative/path/to/file",
     "path": "relative/path/to/file",
     "summary": "...",
     "tags": ["...", "..."],
     "dependsOn": ["other/file.ts"],
     "content": "..."
   }
   ```
4. Mark the file as `[x] COMPLETE` in `.vibe-tracker.md`.
5. If there are still incomplete items, move to the next file. **Do not stop until the tracker is 100% complete.**

## Phase 4: Validation
1. Count the number of total files listed in `.vibe-tracker.md`.
2. Count the number of JSON objects in `.vibe-rag.json`.
3. If the counts do not match, you must find the missing files and process them.
4. Once verified, inform the user that indexing is complete.
