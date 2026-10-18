---
type: record
kind: verification
description: Read for the evidence behind the phone's Convex query retention (the `retention` flavor) and the decisions taken adopting it.
version: 1.0.0
date: 2026-10-18
---

# Mobile query retention

Adopts the `retention` flavor of the
[Convex query caching](../standards/convex-query-caching.md) standard (v1.2.2)
on the phone, item 10 of the [foundry reuse backlog](2026-10-18-foundry-reuse/README.md)
(B 3.1, 3.2). Branch `feat/mobile-query-retention`, based on `f6da670`
(`ConvexSessionGate`, #219). Binding: [`CODING_STANDARDS.md`](../../CODING_STANDARDS.md#local-bindings-and-exceptions).

## What was built

- `apps/mobile/src/convex/queries.ts` — the query module: `useQuery` and
  `useQueries` from `convex-helpers/react/cache`, `usePaginatedQuery` passed
  through from `convex/react`, and the bounds (5 min, 20 idle).
- `apps/mobile/src/convex/QueryCacheProvider.tsx` — the standard's starter
  provider and `CacheLifecycle`, in its own file because it imports React
  Native's `AppState` and pure modules that import the hooks are tested in Node.
- `ConvexSessionGate` renders it, keyed by the Clerk user, in place of the
  keyed `Fragment` it rendered before; `confirmedAccount` is the gate's backend
  confirmation (`users.me`, held across a socket recovery). `users.me` moved to
  `auth/useViewer.ts`, the identity-query adapter, and keeps the raw hook.
- 38 files moved their query hooks to the module. Biome's
  `noRestrictedImports` refuses `useQuery`/`useQueries`/`usePaginatedQuery`
  from `convex/react` in `apps/mobile/{src,app}`, except tests, `queries.ts`
  and `useViewer.ts`.
- `EXPO_PUBLIC_DEBUG_QUERIES=1` (development builds only) logs
  `[convex-query] + name` / `- name` from the client's `ModifyQuerySet`
  messages, i.e. the wire, not the hooks (`convex/debugQueries.ts`).

## Decisions

- **No Group key.** Group reads name their Group in their arguments
  (`groupSlug`, ADR-0031), so another Group is another cache key and cannot
  answer for the current one; the account is entitled to both. The reads
  without a Group (`users.me`, `groups.myGroups`, `accounts.deletionPreview`,
  the tasting Catalog) are the account's. A Group key would also remount
  `GroupProvider` and everything else below the provider on every switch. The
  research row suggested keying by `{userId, groupId}`; the standard keys by
  account only, and nothing above requires more.
- **No `convex-helpers` patch.** Foundry's patch adds `dispose()` and swaps
  `window.setTimeout` for `globalThis`. The standard's `CacheLifecycle`
  releases every subscription itself on unmount, and React Native defines
  `window` as the global (`Libraries/Core/setUpGlobals.js`), so neither is
  needed. 0.1.120 is the newest release whose `convex` peer accepts 1.42.3
  (0.1.121+ need 1.43).
- **Wire-level logging** rather than foundry's per-watcher wrapper: the query
  module holds its own watcher, so a per-watcher log prints `-` on every tab
  change whether or not the server heard anything.

## Automated evidence

- `QueryCacheProvider.test.tsx`: real helper and Convex hooks over a
  controllable `watchQuery` transport — return within expiry renders the live
  value on the first frame with no new subscription; release at expiry; idle
  cap; shared identical readers; Group switch retains; account change releases
  everything before the next account reads; fallback until the backend names
  the account; background releases idle, keeps mounted and component state.
- `debugQueries.test.ts`: add/remove naming, other messages ignored, off by
  default.
- `pnpm check`, `pnpm typecheck`, `pnpm --filter @gather/mobile typecheck`,
  `pnpm test` (179 files, 2,278 tests) passed.
- `expo-updates fingerprint:generate`: Android `2e22a5f9…`, iOS `31c81da7…`,
  identical before and after the change. JS only; ships over the air.

## Device evidence

Android emulator `emulator-5554` (Pixel 9 Pro XL AVD), debug dev client,
Metro on this branch with `EXPO_PUBLIC_DEBUG_QUERIES=1`, shared dev Convex,
the shared test user. Wire log excerpts, in order:

| Step | Wire |
| --- | --- |
| Sign in, Home | `+ users:me`, `+ groups:myGroups` |
| All → Recipes (Test group 2, empty) | `+ recipes:list` |
| Navigate up → Home tab → All → Recipes | *nothing*; the first snapshot after the tap already showed the empty state, not a loading state |
| Switch to Willow Street, All (stack still on Recipes, 8 recipes) | `+ recipes:list` (new Group's args); no `-` for the previous Group |
| Relaunch; All → Recipes → Navigate up → Tasks | `+ recipes:list`, `+ taskLists:list`, `+ notes:list`, 5 × `+ tasks:listByList` |
| Home button (background), Recipes idle, Tasks mounted | `- recipes:list` only |
| Return to foreground | *nothing*; Tasks screen still in place |
| Navigate up from Tasks | *nothing* (7 subscriptions now idle) |
| Settings → Account → Sign out | `- users:me`, `- taskLists:list`, `- notes:list`, 5 × `- tasks:listByList`, `- groups:myGroups`; sign-in screen |

Not covered on device: expiry after five minutes and the 20-entry cap (unit
tests), a direct account switch (unit tests; the gate's own suite covers the
identity mismatch), and paginated lists, which pass through unchanged.

## Found along the way

All tab → Home tab → switch Group → All tab → Home tab crashes the app with
`java.lang.IllegalArgumentException: No view found for id … for fragment
ScreenStackFragment` (react-native-screens). It reproduces identically on
`origin/main` (`f6da670`) with the same steps, so it predates this change.
