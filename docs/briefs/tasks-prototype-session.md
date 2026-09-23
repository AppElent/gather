# Tasks prototype session

Session returned: see [Tasks prototype result](tasks-prototype-result.md). A/Today-first is preferred functionally; visual approval remains pending. The current Close rule below supersedes the original retained-draft scenario.

## Assignment

Answer: how should a Member move between what needs doing today, their own responsibilities and reusable Task lists, while creating and editing through one explicit-Save form?

This is the first of three fresh design sessions, not a production build. Read the [accepted decisions and common prototype contract](../plans/2026-09-16-notes-tasks-calendar-redesign.md) in full, then AGENTS.md, CLAUDE.md, CONTEXT.md and ADR-0021/0034. Read [issue 211 and its scope comments](https://github.com/AppElent/gather/issues/211). Accepted decisions constrain the prototype; propose any changes explicitly and return them to the coordinating session.

## Inspect first

- `apps/mobile/src/modules/tasks/`: current list index, Today strip, list/detail/editor interactions, display preferences and store.
- `apps/mobile/prototypes/tasks-and-notes/`: previous Lists, List, Task and Mix alternatives. These are references; their immediate-save behavior or read-only Todoist assumptions do not override the new decisions.
- `convex/tasks.ts`, `convex/taskLists.ts`, `convex/lib/taskProviders/`: inspect only to understand capabilities. Both providers were read-only at inventory time; ADR-0021's write contract is intended behavior, not implemented behavior.
- Grocery list and Baby checklist consumers of Task lists. Preserve their ability to use ordinary lists.

Known inventory caveat: mobile `moveTask` was a no-op despite its UI. Do not reproduce that as an intentionally working interaction or fix it as unrelated production work.

## Exploration

Proposed starting alternatives, not selected designs:

1. Today first: the next actions lead, with Mine/Everyone and direct access to lists.
2. Lists first: reusable collections lead, with Today/Mine as smart destinations.
3. Responsibility first: work grouped by responsible Member, including Unassigned, with lists available as context.

Make structure and primary actions materially different; preserve the same fixtures and capabilities. Explore the shared create/edit form with assignment, dates, recurrence, reminders and one-level subtasks. Choose a bounded screen flow first; additional screens should answer a named question rather than simulate the whole application.

## Scenarios to judge

- Find an overdue task assigned to yourself and a task due today assigned to someone else; decide whether Mine includes unassigned work.
- Add an ordinary grocery item without exposing chore-management controls unnecessarily.
- Create/edit with explicit Save. Unchanged forms close immediately; changed forms ask Keep editing or Discard. Verify Keep editing preserves input and Discard leaves no retained draft. Shared fixture state changes only at Save; direct completion changes immediately.
- Complete a fixed-schedule overdue task and a completion-based task; show their different next dates and retained history. Demonstrate February for a monthly task on the 31st.
- Complete a parent with unfinished subtasks; confirm the choice. Show parent repetition resetting children, while explicitly identifying unsettled child-date/undo rules.
- Contrast a writable Todoist fixture with read-only Notion and a provider outage. Unsupported actions cannot appear to succeed locally.
- Choose a reminder and show how personal notification controls affect it, without sending notifications.

## Return

Write `docs/briefs/tasks-prototype-result.md` using the common return contract. Include selected landing hierarchy, row density/metadata, list navigation, editor structure, and explicit resolutions or remaining questions for Today/Mine and child behavior. Return to the coordinating session before implementation. Notes may reuse validated interaction vocabulary, not assume every Tasks layout choice fits documents.
