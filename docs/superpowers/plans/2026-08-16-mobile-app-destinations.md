# Mobile app destinations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace module tabs with the prototype-approved five native app destinations, including Profile navigation and a demo Add launcher.

**Architecture:** `SHELL_TABS` becomes the declarative source for Home, Search, Add, Profile, and All. The tabs layout owns the Add sheet's transient state so pressing its disabled native tab never changes the route. Profile becomes a nested tab stack, and its utility routes move under that stack. A small typed quick-action registry supplies demo-only `row`, `sheet`, and `handoff` behavior to the launcher.

**Tech Stack:** Expo Router NativeTabs and Stack, React Native Modal, TypeScript, Vitest node project, Gather mobile i18n.

## Global Constraints

- Follow ADR-0018: native Home, Search, Add, Profile, All; Add is a disabled `NativeTabs.Trigger` which opens a sheet without navigation.
- Profile owns Account, Groups, and Settings so their pushes keep the tab bar.
- Use translated strings in the English and Dutch mobile message trees.
- Keep the action captures intentionally demo-only: no persistence or module mutations in this ticket.
- Do not implement Search; its data shape and no-query state are a separately required spike.
- Test pure public registry/state behaviour only; the mobile Vitest project has no React Native renderer.

---

### Task 1: Define shell destinations and quick-action seam

**Files:**
- Modify: `apps/mobile/src/shell/tabs.ts`
- Create: `apps/mobile/src/shell/quickActions.ts`
- Create: `apps/mobile/src/shell/quickActions.test.ts`
- Modify: `apps/mobile/src/i18n/messages/en.ts`
- Modify: `apps/mobile/src/i18n/messages/nl.ts`

**Interfaces:**
- Produces `SHELL_TABS`, whose names are `home | search | add | profile | all`.
- Produces `QuickAction` with `kind: 'row' | 'sheet' | 'handoff'`, and `QUICK_ACTIONS` containing only working demo actions.

- [x] Write failing registry tests proving the five fixed destination names and the declared `row`, `sheet`, and `handoff` action kinds.
- [x] Run `pnpm exec vitest run --project mobile apps/mobile/src/shell/quickActions.test.ts` and confirm the missing registry fails.
- [x] Implement the typed registry and translated destination/action copy.
- [x] Re-run the focused mobile test and `pnpm --filter @gather/mobile typecheck`.

### Task 2: Install the prototype-approved shell

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/add.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/search.tsx`
- Create: `apps/mobile/src/shell/QuickActionSheet.tsx`
- Create: `apps/mobile/app/(app)/create.tsx`
- Delete: `apps/mobile/app/(app)/(tabs)/recipes.tsx`
- Delete: `apps/mobile/app/(app)/(tabs)/tasks.tsx`
- Delete: `apps/mobile/app/(app)/(tabs)/nutrition.tsx`

**Interfaces:**
- Consumes `SHELL_TABS`, `QUICK_ACTIONS`, `useGroup`, and mobile message dictionaries.
- Produces a disabled Add trigger whose `tabPress` opens `QuickActionSheet` over the active route.

- [x] Render the fixed five NativeTabs triggers, hiding no longer-valid module route segments.
- [x] Use `disabled` plus `listeners.tabPress` for Add and keep a non-rendering `add.tsx` route behind it.
- [x] Port the prototype launcher as translated demo interactions: row expansion, sheet capture, and handoff to the demo create route.
- [x] Typecheck the mobile app after the routes and launcher compile.

### Task 3: Move utility surfaces into Profile

**Files:**
- Create: `apps/mobile/app/(app)/(tabs)/profile/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/profile/index.tsx`
- Move: `apps/mobile/app/(app)/account.tsx` to `apps/mobile/app/(app)/(tabs)/profile/account.tsx`
- Move: `apps/mobile/app/(app)/groups.tsx` to `apps/mobile/app/(app)/(tabs)/profile/groups.tsx`
- Move: `apps/mobile/app/(app)/settings.tsx` to `apps/mobile/app/(app)/(tabs)/profile/settings.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/home/index.tsx`

**Interfaces:**
- Consumes the relocated utility screens through the Profile stack.
- Produces in-stack Profile navigation; Settings links use `/profile/account` and `/profile/groups`.

- [x] Add a Profile index using the existing account and Group context and translated rows.
- [x] Move the three utility routes inside the Profile stack and remove their root Stack declarations.
- [x] Repoint Home’s Settings shortcut and Settings’ child links to the Profile addresses.
- [x] Run `pnpm --filter @gather/mobile typecheck` and `pnpm run check`.

### Task 4: Verify and review

**Files:**
- Modify: `docs/superpowers/plans/2026-08-16-mobile-app-destinations.md` to tick completed steps.

- [x] Run focused mobile registry tests, mobile typecheck, the root typecheck, `pnpm run check`, and the full `pnpm test` suite.
- [x] Review the diff against issue #172 and ADR-0018 on the Standards and Spec axes.
- [ ] Inspect staged files for `.env` files or credentials, then commit with `feat(mobile): add app-level tab destinations`.
