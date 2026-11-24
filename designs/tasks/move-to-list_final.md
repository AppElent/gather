# Move a linked Todoist task to another list — final (APP-821)

A task on a linked Todoist list can move to another list **on the same Todoist
connection**. Todoist moves it itself, so nothing is lost. A list never
switches backend, and a task never changes source (ADR-0021): lists of another
source are shown, disabled, with the reason.

**Canvas:** https://claude.ai/artifact/SBLnxdBz5WDKEMLMxPQ9ex ("Gather — Tasks"),
page `APP-821 Todoist-taak naar andere lijst`. The not-chosen options stay
there: B (also copy to a Gather list) and C (real cross-source move that
deletes from Todoist).
**Approved:** option **A, within the same Todoist account**, by Eric, 24
November 2026 (decision card).
**Final source:** `move-to-list_final/`. `Move.dc.html` is the phone part
(props `screen` menu|sheetA|done, `theme`; its sheetB, confirmB and confirmC
screens are the not-chosen options and are not built). `MoveWeb.dc.html` is the
web edit row (prop `theme`). The `M821-*` files are the approved artboards.
They are a visual reference: build from this file, the phone's tokens and
components (`apps/mobile/DESIGN_SYSTEM.md`) and the web's, not from their
markup.

**Data model:** no change. Linked lists are remote-only (APP-448): the task
lives only in Todoist, and a move is one Todoist call. No table, field, index
or migration.

## The rule

A move is allowed when the task's list and the target list are both writable
linked Todoist lists with the same `providerConfig.connectionId`. Everything
else is disabled:

| From \ to | Same Todoist connection | Other Todoist connection | Local Gather list | Notion list |
| --- | --- | --- | --- | --- |
| Linked Todoist task | **Move** (new) | disabled | disabled | disabled |
| Local Gather task | disabled | disabled | Move (as today, `tasks.moveToList`) | disabled |

The second row fixes a bug found while designing: today the phone's
`MoveToListSheet` lets a local task pick a writable linked Todoist list, and
`tasks.moveToList` then refuses it (`requireLocalList`), so the move fails.

The server enforces the same rule; the UI greying is not the guard.

## Phone

### Task menu (A1)

On a linked task, the task menu shows the existing **Naar lijst verplaatsen…** /
**Move to list…** item (`tasks.list.moveToList`, today hidden on linked tasks),
after **Onder een taak plaatsen…**. Disabled when the list is not writable
(stale, offline, reconnect) as the other write items are. Shown on a subtask
too: Todoist moves a subtask out of its parent into the target list's top
level.

### Choose a list (A2, light and dark)

The existing `MoveToListSheet` (native sheet, title as the menu item). Under
the title one `muted` line: the task's title, plus ", met N subtaken" /
", with N subtasks" when it has any.

The lists are grouped:

1. **The task's own source**, headed by the connection's name ("Todoist ·
   Eric"): every linked list of that connection, in list order. The current
   list shows a check and is not tappable. Footer: "Subtaken, opmerkingen,
   herhaling en herinneringen gaan mee. De sectie niet: in de nieuwe lijst
   staat hij zonder sectie." / "Subtasks, comments, repeat and reminders move
   with it. Its section does not: it lands in the new list without a section."
2. **Andere bron / Other source:** every other list (local, other Todoist
   connections, Notion), at 45 % opacity, not tappable, each row's VoiceOver
   label ending ", kan niet: andere bron" / ", not possible: other source".
   Footer: "Een taak blijft in de bron waar hij staat. Naar een Gather- of
   Notion-lijst verplaatsen kan niet." / "A task stays in the source it lives
   in. It cannot move to a Gather or Notion list."

For a **local** task the same sheet groups the other way: the Group's local
lists first, headed "Gather", then all linked lists under "Andere bron" /
"Other source", disabled.

Each row: the list's tile (its own colour and icon, 28 pt, 8 pt radius), its
name, 48 pt minimum height.

### After the move (A3)

Tapping a list closes the sheet and sends the move. On success the task and
its subtasks leave the current list (the list re-reads, as after any linked
write), with the success haptic and a toast: "Verplaatst naar {list}" / "Moved
to {list}", action **Ongedaan maken** / **Undo**, which moves it back to the
original list (its section is not restored). Failure uses the existing linked
write failures (`useWriteFailed`: offline, reconnect, not found, out of sync,
unconfirmed) and leaves the task where it is.

## Web

In the linked-task edit row (`ExternalTaskList`, next to the **Onder een taak**
select) a **Lijst** / **List** select: an optgroup with the connection's lists
(current selected), and an optgroup "Andere bron (kan niet)" / "Other source
(not possible)" with the other lists as disabled options. Under the fields the
same one-line explanation as the phone's footers. Changing it moves the task
right away (as the parent select does) and the row leaves the list.

## Build notes

- Provider: `TaskProviderWriter` gains a move to another source (for Todoist
  `POST /tasks/{id}/move` with `project_id`), checked against both lists'
  configs. `writeTask` (or a sibling action) takes the target `listId`,
  refuses a target that is not a linked list of the same connection, and
  refuses a target the Member may not write.
- Messages in both apps, `nl` and `en`, through the catalogue.
- Tests: the allowed and refused pairs of the table above, a subtask moving
  out of its parent, the server refusal, the local-task sheet no longer
  offering linked lists.
