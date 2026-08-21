# The Group is addressed on the web and ambient on the phone

Status: decided, not yet implemented (2026-08-13)

## Decision

The web keeps the Group in the URL as [ADR-0002](0002-the-group-is-explicit-in-the-url.md) requires. Mobile keeps one persisted, validated current Group in context; tab routes have no `groupSlug`. A deep link is consumed by `app/g/[groupSlug]/[...rest].tsx`, which selects its Group and replaces into the equivalent tab route.

## Consequences

- A mobile write names its destination Group in the write surface. Reads do not add permanent Group chrome.
- Switching Group resets every tab stack to its root, preventing an id from the prior Group appearing under the new one.
- The retained Group is validated against `groups.myGroups` at launch and falls back to the shared landing Group. Having no Group is a screen outside the tabs.

## Enforcement

`apps/mobile/src/group/GroupProvider.tsx` owns selection and validation. Mobile mutations receive the Group from that context; Convex authorization remains unchanged. See `docs/mobile-interaction.md` for the interaction rules around native navigation.

## Reopen when

The deep-link route cannot select and reset safely in a development build, or native navigation gains a coherent, selected tab model for Group-addressed stacks.
