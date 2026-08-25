# Tasks and Notes on Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Tasks and Notes as household-scoped native mobile modules, while moving all Module routes into the All stack.

**Architecture:** Reuse the existing Convex task backend and port the device-reviewed lab screens into authenticated Group-scoped mobile modules. Add the approved task display, notes, pinning, whole-order reorder, and label-wide mutations; keep pure date/reorder/state helpers at the mobile Vitest seam and Convex access tests at the convex-test seam.

**Tech Stack:** Expo Router, React Native, Convex, TypeScript, Vitest, Biome, pnpm, agent-device.

**Spec:** GitHub issue `AppElent/gather#202`; prototype handoff `C:\Users\ericj\AppData\Local\Temp\claude\gather-202-implement-handoff.md`.

## Global Constraints

- Stay on `AppElent/Tasks-and-notes-module`; do not create or switch branches.
- Adopt `apps/mobile/src/modules/tasks/Checklist.tsx` from the baby checklist rather than retaining the lab geometry copy.
- Every user-visible string is added to English and Dutch message trees.
- Seed representative Tasks and Notes in the same change.
- Verify mobile changes with Android device interaction when possible; Android only.

### Task 1: Routing consolidation

Modify `moduleDestination`, `groupLink`, All/Home route files, the module registry, routing tests, and ADR-0023. Add Tasks and Notes to native destinations, map `/g/<slug>/tasks` and `/g/<slug>/notes`, remove Home Module routes including all seven baby-log routes, and make Home Pins target All.

Test: routing pure tests, typecheck, and the project verify route map.

### Task 2: Backend shape and access

Add `tasks.notes`, `taskLists.display`, `notes.pinned`, the `notes` table and Group-scoped `convex/notes.ts` CRUD, `tasks.reorder`, and label rename/remove sweeps. Add Convex tests for Notes and reorder/label behavior without weakening existing tests.

Test: focused Convex tests, then the full Convex test suite.

### Task 3: Port Tasks

Move/adapt the lab task state helpers and screens into `src/modules/tasks`, adopt Checklist geometry, wire Convex queries/mutations, list display settings, Today strip, task detail sheets, list management, and reorder mode. Add pure state/reorder/date tests and translated copy.

Test: mobile Vitest, typecheck, Biome, and Android device flow.

### Task 4: Add Notes

Port the lab Notes index/detail behavior into `src/modules/notes`, wire Convex CRUD and pinning, add navigation and Group address handling, and add translated copy in core/mobile trees.

Test: mobile Vitest, typecheck, Biome, and Android device flow.

### Task 5: Seed, cleanup, and documentation

Add representative sample household fixtures, update settings/catalog surfaces, remove `src/labs` and Labs routes, amend ADRs and interaction documentation where the shipped behavior changes, and run all verification commands.

Test: full test, check, typecheck, build if practical, and final Android verification attempt only once.
