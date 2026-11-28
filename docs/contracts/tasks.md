---
type: contract
description: Read when changing what completing a task with subtasks does, or when the apps ask "Complete all" or "Only this".
version: 1.0.0
status: current
---

# Tasks

Completing a task that still has open subtasks, on the web and the phone. The
question and its words come from the [tasks design](../../designs/tasks/)
§4 (APP-304); the web gained "Only this" in APP-820, and APP-940 settled the
repeating case below.

## Behavior

- **A one-off task with open subtasks asks first.** "Complete all" checks the
  open subtasks with it, "Only this" leaves them open, Cancel changes nothing.
  Both apps decide whether to ask with one helper,
  `asksAboutSubtasks` in `packages/core/src/subtasks.ts`.
- **A repeating Gather task does not ask.** Completing it moves it on to its
  next occurrence and reopens all its subtasks, whichever answer would have
  been given, so the question would be a lie. Every occurrence starts with its
  subtasks open. Undoing the completion puts back the subtasks that were
  checked before it (`convex/tasks.ts`, `toggleDone` and `undoCompletion`).
- **A linked Todoist task asks without "Only this" unless it repeats.** Todoist
  completes a one-off task's subtasks with it, so only "Complete all" and
  Cancel are offered (APP-448). A repeating Todoist task stays open in
  Todoist, so it offers both answers.
- **"Complete all" is not drawn as destructive.** It can be undone, so it uses
  the primary button on the web and the default alert button on the phone; red
  (`buttonClass.secondaryDanger`) is kept for actions that lose data
  ([general design](../standards/general-design.md)); the design gives
  `danger` only to Delete task.

## Out of scope

- Asking "Only this" on a repeating Gather task. It would need a Convex change
  so the subtasks could stay checked across occurrences (APP-940 triage, 27
  November 2026).

## Acceptance

- `packages/core/src/subtasks.test.ts` (`asksAboutSubtasks`): a repeating task
  does not ask.
- `src/components/tasks/TasksPages.test.tsx`: "a repeating Gather task does not
  ask", and the linked-task cases.
- `convex/subtasks.test.ts` ("a repeating parent"): each completion reopens the
  subtasks for the next occurrence, and undo restores them.
