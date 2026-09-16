# Notes, Tasks and Calendar redesign decisions

Accepted interview decisions as of 16 September 2026; design is ongoing, and this is not an implementation-completion report. Scope and deferred work are recorded in GitHub issues [211](https://github.com/AppElent/gather/issues/211), [212](https://github.com/AppElent/gather/issues/212), [213](https://github.com/AppElent/gather/issues/213) and ADR-0034.

## Tasks

- Creation and editing use the same form with explicit Save. Edits stay in a draft until Save; dismissal retains a recoverable draft. Direct completion in a list applies immediately. This corrects the earlier suggestion of immediate detail-form saves.
- Subtasks are full Tasks with their own assignee and date, initially one level deep. Completing a parent with unfinished subtasks asks whether to complete them too. Repeating a parent resets its subtasks; subtasks do not repeat independently.
- Monthly Tasks scheduled for the 31st use the last available day in shorter months.
- A due date alone creates no reminder; a reminder must be selected.
- One optional responsible current Group Member.
- Fixed-schedule repetition and intervals from completion are explicit alternatives.
- A repeating Task has one outstanding occurrence, which stays visibly overdue instead of accumulating unfinished copies. Completing a fixed-schedule Task advances to the next future scheduled date; completion-based repetition advances from completion. Preserve completion history.
- Today/Mine, subtasks and Todoist write-back are in scope; preserve Notion viewing, provider capabilities and ordinary Task list reuse for groceries and Baby checklists.

## Notes

- Notes autosave, with visible saving/saved/conflict status.
- Checkboxes are document content, without Task assignment, due dates or reminders.
- Formatted editing offers headings, bold, italic, links, bullet/numbered lists, checkboxes and inline images without exposing Markdown syntax. Tables, nested pages and movable content blocks are deferred.
- Recently Deleted retains Notes for 30 days.
- Concurrent edits preserve the person's text and offer a comparison with the latest version; neither person's work is silently overwritten. Browsable version history is deferred.
- Search, pinning, image attachments, correct latest-editor attribution, existing Drop targets and functional web access remain in scope.

## Calendar

- Preserve and complete prior selected elements: fluid Month/Week header, continuous agenda, WHO marks, compact card/expanded sheet and explicit Save. The September 12 plan supersedes the September 2 brief where they conflict; its gesture acceptance remains incomplete.
- Recurrence, reminders, read-only calendar subscription links, multi-day and overnight events, and functional web access are in scope.
- Recurring-event edits offer This occurrence, This and following, and Entire series. One occurrence can be cancelled without deleting its series.
- Each Group has a calendar timezone. Timed events display in it, preserving external events' source timezone; travelling does not change the Group's displayed clock times. All-day dates remain dates. Timed recurring events retain their local clock time in their event timezone. This replaces the earlier no-timezone-conversion boundary; persistence, exact DST gap/fold behavior and migration are not yet designed.
- Calendar recurrence skips nonexistent dates; offer explicit last-day-of-month recurrence. This intentionally differs from monthly Task recurrence.
- Subscriptions refresh automatically about hourly and on manual refresh. On failure, retain the last successful data with a stale indicator. Imported events remain read-only; hiding a subscription is a private view choice.
- Personal reminder default for timed events is 15 minutes before, configurable or off. All-day events initially have no automatic reminder. Recipient rules and personal notification settings still apply.

## Personal notifications

- Notify the recipient when another Member assigns them a Task or adds them to an event.
- Scheduled reminders use explicit recipients, initially oneself. Unassigned records do not automatically notify every Member.
- Personal defaults apply across Groups, with separate switches for Tasks/Calendar and assignment notifications/reminders, plus a per-Group mute.
- Email notifications and quiet-hour scheduling are deferred. OS permission behavior, delivery channels beyond deferred email, and deduplication/failure behavior remain open.

## Prototype sessions

Mobile first, iOS focused; basic web functionality is required but dedicated web design is deferred. Use three structurally distinct UI alternatives and allow combining selected elements. For Calendar, retain the current structure as one alternative and reconcile earlier selections against implementation first. Existing materials live in `apps/mobile/prototypes/calendar/` and `apps/mobile/prototypes/tasks-and-notes/`.

## Session sequence and authority

Keep this thread as the coordinating design session. Run fresh prototype sessions in order: [Tasks](../briefs/tasks-prototype-session.md), [Notes](../briefs/notes-prototype-session.md), then [Calendar](../briefs/calendar-prototype-session.md). Each returns its findings here before the final implementation spec and dependent tickets are produced. These briefs authorize bounded throwaway exploration when invoked; preparing them does not start sessions or authorize production implementation.

The original feature-gap issues retain future proposals and deferred work. Accepted interview decisions here override older conflicting prototype defaults. Historical artifacts remain evidence, not automatic authority over newer decisions. No prototype winner has been selected in this redesign.

## Open decisions for the final spec

- Tasks: Today/Mine inclusion of unassigned work; undoing recurring completion; early completion; child due dates on repetition; retained child completion history; provider capability mapping for assignment/recurrence/subtasks and outage reconciliation.
- Notes: document representation and cross-client editor compatibility; conflict comparison/resolution; image limits and storage access; autosave failures, recovery and retention after loss of Group access.
- Calendar: exact DST gap/fold behavior; timezone selection/change and migration of existing events; external timezone-less feed values; recurring-series exceptions after subsequent edits; feed removal and stale-data lifecycle.
- Notifications: permission timing, supported delivery platforms, recipient consent, mute/disable semantics for queued reminders, cancellation/rescheduling and duplicate suppression. Prototype visible behavior; implementation details belong in the final spec.
- Basic web functionality needs an explicit acceptance checklist per Module in the final spec. A deferred visual design session is not permission to leave web placeholders.

## Common prototype contract

Use the prototype skill's UI branch: three structurally distinct alternatives on one route with a URL variant parameter and floating switcher. Prefer an existing relevant route and app shell, keep real writes stubbed, and use in-memory fixtures. Use the repo's routing convention if a dedicated prototype route is needed, documenting the reason. Give one pnpm run command and a usable URL/deep link. Surface relevant prototype state separately from product UI. A logic demo may answer a specific unresolved behavior in a separate self-contained HTML file; it does not replace the UI exploration.

Design for iOS first, include EN/NL and large-text/dark-state checks, and distinguish browser layout evidence, Android interaction evidence and actual iOS verification. Windows cannot establish iOS-native gesture or keyboard behavior. Production mobile changes require device verification per AGENTS.md; prototypes carry no production-readiness claim. Use no live provider writes, notification delivery, migrations, sample resets or production deploys.

Preserve existing Labs and historical prototypes. `apps/mobile/src/labs/entries.ts` says to retain Labs prototypes, while the prototype skill archives new throwaway work outside main. For these sessions archive new alternatives on a prototype branch at closeout and leave existing Labs intact; flag any proposed change to that convention explicitly. No push or merge is implied by a local prototype branch.

The repo instructions reference `docs/mobile-interaction.md`, which is missing in this checkout as of this handoff. Consult `docs/research/mobile-interaction-vocabulary.md` and current native wrappers for evidence, flagging any rule that cannot be recovered rather than silently inventing a replacement.

Every session returns a result file next to its brief with: question answered; runnable artifact and variant references; user-selected elements and reasons; rejected options; unresolved questions; scenarios exercised and verification limits; proposed changes to accepted decisions; and prototype branch/commit pointer when archived. If the user has not selected a design, say pending. Return findings to this coordinating session; do not promote prototype code or mark an issue implementation-ready.
