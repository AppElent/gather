# Tasks redesign — throwaway exploration

## Native A — current review surface

The user prefers A's functionality and requested real native interactions.
Use the existing development build; no native rebuild is needed:

```sh
pnpm --filter @gather/mobile start:dev-client --port 8082 --lan
```

Connect the phone to this branch's Metro, then open **All → Tasks → Tasks
prototype** (Dutch: **Alles → Taken → Takenprototype**). Deep link:
`gather://all/tasks-prototype`. The entry and route are development-only.
Port 8081 belongs to Workouts; do not stop that server.

The code lives in `apps/mobile/src/modules/tasks/prototype/` and uses its own
in-memory store. Native review steps:

1. Open the top-right list chooser and ellipsis menu.
2. Hold a row for Complete/Edit/Date/Delete.
3. Swipe fully right to complete, fully left to edit; short swipes reveal actions.
   iOS uses SwiftUI List/SwipeActions; Android uses gesture-handler.
4. Add or Edit opens a keyboard-anchored composer. More details expands upward;
   Save stays in the header. Date uses the native picker.
5. Close a changed form: Keep editing or Discard changes. Discard leaves no draft;
   unchanged forms close immediately. This supersedes draft recovery on Close.
   The composer is not currently drag-to-dismiss; chooser/inspector are sheets.
6. Open a list and use native Back. Inspect History and Prototype controls from
   the ellipsis. Use app Settings for EN/NL and appearance, and iPhone settings
   for Dynamic Type.

Mobile TypeScript, scoped Biome and iOS bundle compilation passed. Android checks
inside Expo Go verified date/save, unchanged-form dismissal, draft resume/save,
keyboard layout and full-swipe execution. iPhone native review is still pending.
No native package, app configuration, backend, rebuild or deployment was changed.

## Browser alternatives (preserved)

From this branch's repository root:

```sh
pnpm prototype:tasks
```

Open http://localhost:4311/prototype/tasks?variant=A.

- A: Today first, Everyone/Mine segment, lists below the work.
- B: Lists first, Today and all-date Mine destinations.
- C: Responsibility first, including an explicit Unassigned section.

The floating arrows (or left/right keyboard arrows outside form fields) change
the URL variant without discarding fixture state. Refresh resets all data.
Use the controls outside the phone for language, dark/large text, scenario date,
provider availability, notification preferences, and Mine/unassigned inclusion.
The expandable inspector exposes all tasks, drafts and completion history.

This standalone browser route follows the existing mobile prototype directory
precedent. It deliberately does not mount in the production Expo or authenticated
web route: the question is about the iOS mobile hierarchy and unsaved drafts,
and all writes must be fictitious. The miniature Gather shell provides context;
its unrelated tabs are visual references, not simulated modules. Only the
dedicated Node server serves this route/switcher. The production build does not
import any of these files.

## Suggested walkthrough

1. Compare A/B/C. Find Eric's overdue plumber task and Anne's parcel due today.
   Compare A's filtered Today with B's all-date Mine. Toggle unassigned inclusion.
2. Open Groceries, add an item using the compact composer, Close, Resume draft,
   then Save. Details stay collapsed for simple capture.
3. Open an existing task. Edit, dismiss, resume and Save; use the inspector to
   see that the shared fixture changes only at Save.
4. Complete the bins: from 15 September overdue to Tuesday 22 September.
   Complete the bathroom: confirm child completion, then advance to 23 September.
   Inspect retained history and reset children. Child date behavior is unsettled.
5. Use **31 Jan → February**, then complete the meter reading: 28 February.
6. Reset. Try Notion completion (disabled), writable Todoist completion
   (simulated acknowledgement), and a Todoist outage (disabled, cache retained).
7. Choose a due date and explicitly select a reminder. Close the draft; change
   personal notification controls; resume to see the effect. No messages send.

## Boundaries

- User preference: Todoist is the reference. Its compact composer, metadata rows,
  completion circles, assignee markers and list context inform this first pass.
  A is the user's preferred functional direction. Visual design is not approved:
  some parts do not feel like iOS. Specific elements remain under review.
- One explicit-Save create/edit form remains accepted. Browser drafts survive
  dismissal/navigation/variant changes only, not refresh or process restart.
- English task titles are Group content and remain English in Dutch UI.
  Prototype controls/diagnostics remain English; product controls have EN/NL.
- Recurrence choices are representative fixed Tuesday, seven days after
  completion and monthly on the 31st. This is not a general recurrence editor.
- Todoist field mapping is unresolved. Assignment, recurrence, reminders and
  subtasks are disabled there; save refuses unsupported fields carried from
  a local draft. This is a conservative fixture, not a provider capability spec.
- Child title/assignee/date edits are included. Full independent child navigation
  and completion, deletion, reorder, Drop capture and cross-list moves are not
  explored in this bounded pass. Existing production features remain untouched.
- Child dates remain unchanged when the parent repeats, visibly marked as an
  unaccepted placeholder. Child history snapshots are observable, not a retention
  decision. Recurring undo and early completion still need design.
- Draft conflicts with an independently completed task need a final-spec rule;
  avoid completing the same task while it has a suspended editor draft here.
- Bulk Reschedule is a proposal inspired by the screenshot. It confirms before
  moving eligible non-repeating writable tasks to tomorrow; repeating tasks and
  read-only providers are excluded. This policy has not been accepted.
- Voice, attachments, OS keyboards, native sheet gestures, production provider
  integration and notification delivery are not implemented or verified.

Browser checks and the decision ledger are in
[`docs/briefs/tasks-prototype-result.md`](../../../../docs/briefs/tasks-prototype-result.md).
