# Notes prototype session

## Assignment

Answer: how can a Group quickly capture, find and safely edit shared information without Notes becoming a task manager or knowledge-base application?

This is the second design session. Read the [accepted decisions and common prototype contract](../plans/2026-09-16-notes-tasks-calendar-redesign.md) in full, AGENTS.md, CLAUDE.md, CONTEXT.md, ADR-0034 and [issue 212 with scope comments](https://github.com/AppElent/gather/issues/212). If `tasks-prototype-result.md` exists, read it for validated interaction vocabulary; do not infer a Tasks verdict if absent.

## Inspect first

- `apps/mobile/src/modules/notes/`, the notes portions of `apps/mobile/src/modules/tasks/store.ts`, `convex/notes.ts`, and the Notes web placeholder.
- `apps/mobile/prototypes/tasks-and-notes/`: Notes/Note/Mix alternatives.
- `apps/mobile/src/drop/dropTargets.ts`: preserve create and append-to-existing-note behavior.

Inventory: current Notes are plain text with a disabled formatting toolbar, hard deletion, client-side search and creator-based edited-by attribution. The shared task store couples Notes to task fetching; this is implementation debt, not an accepted product requirement. Note pinning is shared note state, distinct from the glossary's personal Module Pin.

## Exploration

Proposed starting alternatives, not selected designs:

1. Compact document list with pinned and recent sections.
2. Content previews with image/checklist snippets and prominent capture.
3. Search-led retrieval with a small pinned reference area and chronological documents.

All alternatives support the accepted formatting, autosave status and recovery model. Explore editor controls, image placement, checkboxes and conflict comparison. Do not add folders, labels, movable blocks, task conversion or collaborator cursors. Storage format is not settled merely by rendering a rich editor.

## Scenarios to judge

- Find a pinned household reference, then find an older note by body text.
- Capture text or a link into a new note and append to an existing one.
- Compose a packing note with headings, links, checkboxes and an image; checkboxes do not expose task dates or assignment.
- Autosave normal changes; simulate a failed save and make retained input and save status understandable.
- Simulate another Member editing the same note. Show both versions, preserve local work and explore a resolution choice without silently overwriting either version.
- Delete and restore a note in Recently Deleted; explain its 30-day retention without adding version history.
- Show the actual last editor, not merely the creator; distinguish note pinning from personal sidebar Pins.

## Return

Write `docs/briefs/notes-prototype-result.md` using the common return contract. Include collection layout, editor/keyboard affordances, save/conflict feedback, deletion recovery and unresolved attachment/security/editor decisions. Return to the coordinating session; the final spec must separately define a functional web editor and its format compatibility.
