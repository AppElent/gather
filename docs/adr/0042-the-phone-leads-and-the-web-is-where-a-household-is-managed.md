---
type: decision
description: Read before deciding which platform a feature ships on, adding or moving a web or phone route, or adding a shareable link.
version: 1.0.0
status: accepted
date: 2026-11-11
---

# The phone leads, and the web is where a household is managed

Gather has two clients of one Convex backend: the TanStack Start web app and
the Expo phone app. Nothing said which features belonged on which. The web
grew placeholder pages for Modules only the phone has, the phone lost things
only the web had (an invite code, leaving a Group), and the web lost account
deletion. This ADR applies the platform-parity standard
([AppElent/developer-home#2](https://github.com/AppElent/developer-home/pull/2))
to Gather: each platform's goal decides what goes on it, and
`packages/core/src/features.ts` lists every feature with its status, its
platforms and its reason. `scripts/feature-manifest.test.ts` fails CI when a
route file on either platform belongs to no feature.

## Decision

**The phone is the leading platform.** It is for daily capture: tasks, notes,
calendar, groceries, pantry, meal planner, recipes, tasting, the baby log,
recurring costs, shared costs and savings goals, the finance Labs, and Drop. A
new feature ships on the phone only, unless it is floor or a share target.

**The web is for sitting down to manage**: recipes (long editing), Groups
(Members, roles, rename, appearance, invites), integrations, and settings. Web
pages are responsive first. No page is declared `large-screen` today.

**The floor is not reduced.** Both platforms have sign-in, sign-up and password
reset; account and profile editing; account deletion; data export; language;
theme; and the privacy page. Once Gather has a share link, it must open on
either platform too ([APP-84](https://linear.app/appelent/issue/APP-84)). Where one is
missing it is `pending-port` with a follow-up:

- Account deletion is on the phone only ([APP-85](https://linear.app/appelent/issue/APP-85)). [ADR-0032](0032-an-account-is-deleted-in-the-app-and-takes-its-solo-groups-with-it.md)
  put it in the app because the App Store requires it there. It does not
  forbid the web, and the web port reuses the same cascade
  (`accounts.deleteAccount`, `cascade.purgeAccount`).
- Signing out other devices is on the phone only ([APP-82](https://linear.app/appelent/issue/APP-82)).
- Leaving a Group counts as account management, so it is floor. It is on the
  web only ([APP-80](https://linear.app/appelent/issue/APP-80)).
- Data export covers every table on both platforms: one server registry
  (`convex/lib/dataExport.ts`, keyed by every table, so a new table fails
  typecheck) and one collector (`@gather/core/data-export`).
- Name and password are editable on both platforms. The email address is
  read-only on both. The phone's email screen still says addresses are added on the web,
  which has no such editor; that copy is stale.

**Data parity, not screen parity.** Export and deletion cover everything on
both platforms. The web does not have to show data whose feature is
phone-only, so calendar, notes, groceries, pantry, meal planner, recurring
costs, shared costs and savings goals are `exclusive` to the phone. Their web
routes still render `ModulePlaceholder` ("planned"). They are one feature,
`planned-web-modules`, until Eric decides for each Module whether to build it
on the web or remove the page ([APP-83](https://linear.app/appelent/issue/APP-83)).

**A Group invite is a share target.** Today an invite is the Group's invite
code ([ADR-0006](0006-any-member-invites-only-an-admin-removes.md)), not a
link. Someone without the app can accept one in a browser: sign up on the web
and enter the code on `/groups`. Joining with a code works on both platforms.
Showing the code works only on the web, so nobody can invite from the phone
([APP-80](https://linear.app/appelent/issue/APP-80)).

**One web client.** Expo web is not a deploy target. `apps/mobile` lists
`platforms: ["ios", "android"]`, has no `web` script or `web` config, and the
stray root `app.json` (`{"expo": {}}`) is gone. `react-native-web` stays as a
phone dev dependency only because `apps/mobile/.ds-sync/build.mjs` renders the
phone's components in a browser for the design-system sync
(`.design-sync/NOTES.md`). It is not an app target.

**Universal links: none yet.** The rule is to claim only `https` paths the app
can open today, and Gather has no web share link at all: invites are codes,
and no web page is meant to be sent to someone. Claiming nothing is therefore
correct, not a gap. The Apple
Team ID and the Play signing SHA-256 are not in the repository either. [APP-84](https://linear.app/appelent/issue/APP-84)
plans the first link: an invite link `https://gather.appelent.nl/join?code=…`
that the web accepts in a browser and the phone claims with
`ios.associatedDomains`, an Android `intentFilters` entry, and
`public/.well-known/` files served as `application/json`.

**Old `/g/<slug>/…` links.** [ADR-0031](0031-the-current-group-is-ambient-on-web-and-mobile.md)
made the web answer not-found for them and asked deep-link behavior to move to
the ambient model. The phone still consumes `gather://g/<slug>/…`
(`app/g/[groupSlug]/[...rest].tsx` → `(app)/deep-link.tsx`), a scheme nothing
produces any more and the web cannot open. That handler is retired ([APP-81](https://linear.app/appelent/issue/APP-81)), not
mirrored on the web.

## How this sits with earlier decisions

- [ADR-0015](0015-the-group-is-addressed-on-the-web-and-ambient-on-the-phone.md)
  is superseded by ADR-0031; this ADR does not revive URL-addressed Groups.
- [ADR-0017](0017-the-phone-owns-its-look-and-shares-its-words.md) stands: the
  same feature looks native on each platform and shares its words.
- [ADR-0018](0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md):
  Search and Add are phone destinations, so they are `exclusive` to the phone.
- [ADR-0031](0031-the-current-group-is-ambient-on-web-and-mobile.md) stands:
  `/g/…` stays not-found on the web.
- [ADR-0033](0033-the-phones-all-screen-is-arranged-on-the-device.md): the All
  screen is on both platforms (`parity`), and its arrangement stays per client.
- [ADR-0037](0037-the-phone-is-a-clerk-generation-ahead-of-the-web.md) and
  [ADR-0038](0038-both-clients-speak-clerk-core-3.md): both clients speak Clerk
  Core 3, so the phone's account screens are a fair reference for the web's
  deletion and devices ports, and the other way round.

## Consequences

- A route file on either platform must belong to a feature in
  `packages/core/src/features.ts`, and a new feature's issue states its
  platforms. The PR that adds it adds the entry.
- Moving a phone Module to the web, or removing its placeholder, changes
  `planned-web-modules` and that Module's entry in the same PR.
- Taking `web` out of the Expo config and scripts changed the phone's runtime
  fingerprint ([ADR-0029](0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)),
  so the next update after this lands needs a new native build first.

## Rejected

- Full parity, every Module on both platforms: the web would rebuild
  phone-shaped capture screens nobody sits down to use.
- Showing the web's placeholder Modules as `pending-port`: that promises a web
  port nobody has decided on. [APP-83](https://linear.app/appelent/issue/APP-83) decides it per Module.
- Web routes for `/g/<slug>/…`: they would reverse ADR-0031.
- Removing `react-native-web` entirely: it would break the design-system sync,
  which is not Expo web.

## Reopen when

- A web share link exists ([APP-84](https://linear.app/appelent/issue/APP-84)): update the universal-links scope here.
- Eric decides the placeholder Modules ([APP-83](https://linear.app/appelent/issue/APP-83)).
- The web becomes the main place for daily capture, or the phone for managing
  Groups.
- The design-system sync stops rendering through `react-native-web`: remove the
  dependency.
