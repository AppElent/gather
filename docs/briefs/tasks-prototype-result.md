# Tasks prototype result — functional direction selected, visual review pending

This coordinating-session record incorporates the user's report-back. It is design evidence, not a production implementation or release-readiness claim.

## Primary source

- Local branch: `prototype/tasks-redesign`.
- Archived commit inspected: `ba379c914724b11c0a74621591521492a0b2ec77`.
- Full session ledger at that commit: `docs/briefs/tasks-prototype-result.md`.
- Browser alternatives: `apps/mobile/prototypes/tasks-redesign/`; run `pnpm prototype:tasks`, URL `http://localhost:4311/prototype/tasks?variant=A` (B/C also available).
- Latest native A: `apps/mobile/src/modules/tasks/prototype/`; development entry `gather://all/tasks-prototype`. Run the development client from that prototype checkout; the archived session used Metro on port 8082. Browser alternatives preserve historical Close behavior; native A is the latest interaction exploration.

## Accepted direction

- A, Today-first, is preferred for functionality. Visual design is not approved; the user did not confirm the latest iPhone spacing revision.
- Carry forward Tasks/Taken as the title, native menus, full-swipe capability, and a keyboard-anchored composer expanding upward with an obvious Save.
- Create/edit retain explicit Save. Unchanged forms close immediately. Closing changed input asks Keep editing or Discard; Discard closes and removes that draft.
- This replaces Tasks' earlier draft-on-close/resume rule. It does not replace Calendar draft semantics or decide recovery after interruption/restart.
- Preserve other accepted domain decisions. Attachments and voice remain outside Tasks scope.
- B/C are not preferred as whole functional directions, but their individual elements have not all been rejected. Exact swipe direction/action mapping, row density, detailed navigation and styling remain reviewable.

## Final-spec follow-up

Resolve Mine/unassigned behavior; recurring subtask dates and independently accessible assigned children; undo/history and early completion; provider capability mapping and reconciliation; notification consent/scheduling/rescheduling/deduplication. Keep interruption recovery and conflict behavior distinct from deliberate Close. No new semantics are inferred from placeholder behavior in the prototype.

## Evidence and limits

The user reports Android functional checks passed. The archived ledger reports checks of Save/Close, Keep editing/Discard, dates, composer/keyboard and full swipes, plus scoped formatting, TypeScript and iOS bundle compilation. Earlier checks exercised the superseded resumable-draft behavior; the latest Close verification supersedes them.

Latest iOS spacing and native interaction details still require confirmation, including picker/composer lifecycle, menus, swipe feel, safe areas, accessibility and Dynamic Type. Browser checks, Android checks and iOS bundle compilation do not establish iOS correctness. No checks were rerun in this coordinating session.

## Lessons carried forward

1. Move to native early when keyboard, sheets, menus or gestures are the design question.
2. Record functional preference separately from visual approval.
3. Settle Save/Close before introducing richer fields.
4. Investigate native-wrapper lifecycle when a picker disappears; the reported iOS cause remains unconfirmed.
5. Test with the actual keyboard and inspect safe areas and floating navigation.
6. Record superseded decisions explicitly so the final spec does not revive rejected behavior.

Next: Notes prototype session; carry these process lessons forward without applying Tasks Close semantics to Notes autosave. Return here for the final spec after Notes and Calendar findings are available.
