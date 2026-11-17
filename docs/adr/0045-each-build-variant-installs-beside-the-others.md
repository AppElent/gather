---
type: decision
description: Read before changing the phone app's name, bundle ID, scheme, icon, share-extension app group or widget extension, or adding an EAS build profile.
version: 1.1.0
status: accepted
date: 2026-11-17
---

# Each build variant installs beside the others

> Adopts the toolkit's mobile-distribution standard
> (`docs/standards/mobile-distribution.md`): `app.config.ts` with `APP_VARIANT`.

## Decision

`apps/mobile/app.config.ts` gives each EAS profile its own identity, picked by
`APP_VARIANT`, which every base profile in `eas.json` sets and the update
publisher sets to the channel:

| Variant | Profiles | Name | Bundle ID / package | Scheme | Icon |
| --- | --- | --- | --- | --- | --- |
| `production` | `production` | Gather | `com.appelent.gather` | `gather` | plain |
| `preview` | `preview`, `preview-internal` | Gather Preview | `com.appelent.gather.preview` | `gather-preview` | blue PREVIEW band |
| `development` | `development`, and any local run (unset) | Gather Dev | `com.appelent.gather.dev` | `gather-dev` | orange DEV band |

The share extension's app group follows the bundle ID
(`group.com.appelent.gather<suffix>`), so a share reaches only the app whose
extension took it. `app.json` keeps everything shared; the badged icons are
committed files made by `apps/mobile/scripts/badge-icons.mjs`.

The widget extension (`apps/mobile/targets/widgets/`, APP-207) follows the
same suffix: `com.appelent.gather<suffix>.widgets`, named after its app, so
its Control Center control reads "Gather", "Gather Preview" or "Gather Dev".
Its intent runs inside the app it opens, so it needs nothing per variant
beyond that, and joins no App Group.

## Consequences

- Preview, production and a dev client install side by side, and the first
  Android preview build no longer creates the upload key that signs Play Store
  builds.
- The bundle ID enters the runtime fingerprint, so each variant has its own.
  `fingerprint.mjs`, `ota-gate.mjs` and `publish-update.mjs` resolve it with
  `APP_VARIANT` set to the channel. A bare `eas update` resolves to
  `development`, which no preview or production build runs.
- Builds made before this decision (`com.appelent.gather` on the `preview`
  channel, up to build 26) keep working against production but get no further
  updates. Install the new Gather Preview build and delete the old one.
- The first build of each new bundle ID (and its share and widget extensions) runs
  interactively once, so EAS can create its ad hoc profile and app group.
- Any native sign-in that checks the bundle ID (none today: `appleSignIn` is
  off and the app has no SSO) must register each variant's ID on the Clerk
  instance it uses.
