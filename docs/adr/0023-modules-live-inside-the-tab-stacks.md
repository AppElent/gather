# Modules live inside the All tab stack

Status: decided (2026-08-24), implemented

Modules with native screens live once, inside the All tab's stack. Home Pins
switch to All before pushing the Module. This keeps the tab bar and Add action
available while avoiding duplicate route trees.

## Why the earlier decision changed

The earlier decision put each Module in both the Home and All stacks as thin
route files. That preserved a separate back stack per tab, but it created two
addresses for every screen. `groupLink.ts` already resolves supported deep links
to `/all/...`, so the Home copies had no incoming address that the All copies did
not also serve.

The reversal is intentionally limited to route ownership: shared Module screens
remain under `src/modules/<module>/`, while the route files are declared only in
the All stack. Home remains the Group's shared surface and its Pins are links
into the All stack.

## Costs accepted

- Tapping a Pin changes the selected tab to All.
- Back from a Module opened by a Pin lands on All's index rather than Home.
- A Module has one address, so its stack position is the All stack's position.

These costs are preferable to a Module being reachable at two addresses, and
they match the existing deep-link behavior. If Home later needs a distinct
Module workflow, that is a new route decision rather than a reason to restore
duplicate screens.
