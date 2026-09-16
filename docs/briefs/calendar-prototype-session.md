# Calendar prototype session

## Assignment

Answer: how should the existing selected Calendar experience accommodate recurrence, subscriptions, multi-day events and reminders while completing the interactions already chosen?

This is the third design session. Read the [accepted decisions and common prototype contract](../plans/2026-09-16-notes-tasks-calendar-redesign.md) in full, AGENTS.md, CLAUDE.md, CONTEXT.md, ADR-0034 and [issue 213 with scope comments](https://github.com/AppElent/gather/issues/213). Read prior Tasks/Notes result files if present. This session starts with reconciliation, not a blank-sheet redesign.

## Reconcile earlier selections

Read `apps/mobile/prototypes/calendar/build-brief.md`, `docs/plans/2026-09-12-mobile-calendar.md`, `docs/plans/2026-09-12-mobile-calendar-progress.md`, and `apps/mobile/src/labs/calendar/`. Inspect production `apps/mobile/src/modules/calendar/`, `packages/core/src/calendar.ts`, `convex/calendar.ts` and relevant `convex/kitchen.ts` functions.

Produce a short matrix: user-selected behavior / current implementation / verification evidence / remaining gap. Preserve fluid Month/Week header, continuous agenda, WHO marks, card plus expanded sheet and explicit Save as the baseline. The user liked elements from multiple options and explicitly says not everything selected was implemented. The September 12 plan supersedes the September 2 brief; current joint redesign decisions supersede its local-only, same-day and no-timezone-conversion boundaries. Distinguish original user selections from defaults the September 12 handoff author chose.

Inventory to verify: production already includes coloured local calendars, private calendar/people filters, multiple involved Members, editing/duplicate/delete, location/notes, retained drafts and revision conflicts. Gesture and iOS acceptance were incomplete. A suspected loading defect leaves `useCalendarData` anchored to today while the screen changes its active date; inspect before assuming distant navigation loads correctly. Metadata pagination may also stop at its initial page. These are observations, not permission for unrelated fixes in this prototype session.

## Exploration

Keep current structure as alternative A. Propose B and C around distinct ways of navigating agenda, month and event details, informed by reconciliation. They may recombine earlier selections; changed settled interactions must be presented as proposals. Keep existing Group boundaries, private filters and explicit-save/draft semantics in every alternative.

## Scenarios to judge

- Scroll continuously across days and months; collapse/expand the header; select an empty distant day and return to today. Identify actual native gesture evidence separately from a browser simulation.
- Create/edit an event with several Members, time, location and notes; expand/collapse the editor without losing the draft; dismiss/resume/Save.
- Show a multi-day holiday and an overnight event with clear day boundaries.
- Move one lesson in a recurring series, cancel one occurrence, and edit following occurrences. Show monthly-on-31st skipping February versus explicit last-day recurrence.
- Display a timezone-aware imported event in the Group timezone while preserving its source timezone; travel does not alter Group display times. Demonstrate wall-clock recurrence through a DST change and flag exact gap/fold rules as open.
- Show read-only subscription data, last refresh, failed refresh with stale retained data and personal hiding.
- Configure the personal timed-event reminder default, override it, turn it off, and show Group mute effects. No actual notification delivery.

## Return

Write `docs/briefs/calendar-prototype-result.md` using the common return contract, including the reconciliation matrix. Name selected elements individually instead of declaring an entire variant the winner when the user chose a mix. Return unresolved timezone migration, DST, series-exception and subscription lifecycle questions to the coordinating session before the implementation spec.
