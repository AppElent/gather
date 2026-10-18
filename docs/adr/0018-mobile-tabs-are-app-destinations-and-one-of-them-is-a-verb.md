---
type: decision
description: Read before changing the phone's tab bar or its Add action.
version: 1.0.0
status: accepted
date: 2026-08-16
---

# Mobile tabs are app destinations, and one of them is a verb

Implemented, and amended on one slot (2026-08-17).

## Decision

The fixed native tabs are Home, Search, Add, Settings, and All: app-level capabilities, never Modules. Add is a disabled native tab item whose press opens the launcher over the current route. Settings owns its stack, including Account and Groups.

## Consequences

Modules remain reachable from Home and All. Each quick action declares `row`, `sheet`, or `handoff`; the launcher only presents actions that work. A `handoff` returns to its initiating context. Settings links stay inside the Settings stack so the native tab bar remains visible.

## Enforcement

`apps/mobile/app/(app)/(tabs)/` defines the fixed stacks and `QuickActionSheet` implements declared action kinds. Platform-owned tabs and sheets follow [`apps/mobile/DESIGN_SYSTEM.md`](../../apps/mobile/DESIGN_SYSTEM.md#interaction-vocabulary); module routes are governed by [ADR-0023](0023-modules-live-inside-the-tab-stacks.md).

## Reopen when

The disabled Add item becomes visually dimmed, a fifth capability must displace a tab, or Ask Gather earns a permanent destination.
