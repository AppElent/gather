---
type: decision
description: Read before changing the Apple TV app's dependencies, bundle ID or EAS profiles, or moving the phone to a newer Expo patch.
version: 1.0.0
status: proposed
date: 2026-11-23
---

# Gather TV is its own app, on the phone's App Store record

> Proposed until Eric confirms the bundle IDs on the APP-643 pull request.

## Decision

`apps/tv` is a separate Expo app. Its `react-native` is an alias for
`react-native-tvos`; `apps/mobile` keeps stock `react-native`. The two share
`packages/core` and the Convex generated API, and nothing native.

The TV app takes the phone's bundle IDs, per `APP_VARIANT` (ADR-0045):

| Variant | Bundle ID |
| --- | --- |
| `production` | `com.appelent.gather` |
| `preview` | `com.appelent.gather.preview` |
| `development` | `com.appelent.gather.dev` |

One bundle ID on two platforms makes the TV app a tvOS version on the iPhone
app's App Store record: one listing, one purchase, one set of users. It cannot
be moved to a record of its own once shipped.

The TV app stays one Expo patch ahead of the phone: `expo` 58.0.22, exactly.
Xcode 27.2 crashes compiling `expo-modules-core` 58.0.28 for tvOS; 58.0.29 and
later hold the fix. A `pnpm patch` was rejected: it applies to every workspace
package that resolves 58.0.28, and pnpm puts the patch hash in the directory
name, so it would change the phone's native input and fingerprint (ADR-0029).

`@expo/log-box` is pinned to 58.0.13 for the whole workspace. It is an
auto-installed peer of the phone's `expo-router`, and pnpm gives the phone the
newest copy in the graph, so the TV's newer copy moved the phone's fingerprint.

## Consequences

- The phone keeps its runtime version, and its installed builds keep taking
  updates.
- When the phone moves to `expo` 58.0.22 or later, align both apps and remove
  the `@expo/log-box` override.
- There is no EAS project id, update channel or production profile yet. The EAS
  project (the phone's or a new one) is chosen with the first EAS build.

## Enforcement

`scripts/tv-isolation.test.ts` reads the lockfile: the phone resolves stock
`react-native` 0.88.1 and the TV resolves the fork. The `Mobile runtime`
workflow compares the phone's fingerprint on every pull request that touches the
lockfile, but it is informational: read its comment before merging.

## Reopen when

Eric wants a separate App Store record, before the first tvOS upload; or the fork
stops tracking the phone's React Native minor.
