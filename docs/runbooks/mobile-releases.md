---
type: runbook
description: Read when publishing an over-the-air update, making a store or internal build, or rolling an update back.
version: 1.1.0
---

# Mobile releases

Gather facts for the shared [mobile baseline](../standards/mobile-baseline.md#build-and-release-boundaries).
Run the commands from `apps/mobile`. Development builds are in
[mobile verification](mobile-verification.md#development-build).

## Over the air or a new build

A change reaches installed builds one of two ways, and which one is not a
judgement call — `expo-updates` decides it mechanically. See
[ADR 0029](../adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md).

**Over the air** — anything that is only JavaScript, TypeScript, or a bundled
asset: a screen, a string, a Convex query, an image in `assets/`. Publish it:

```
pnpm update:preview --message "what changed"
pnpm update:prod    --message "what changed"
```

Each script runs `apps/mobile/scripts/publish-update.mjs`, which pairs
`--channel` with `--environment`, as the
[mobile baseline](../standards/mobile-baseline.md#build-and-release-boundaries)
requires; publish only through them. Here a bare publish would point
production phones at the dev Convex deployment and the Clerk test instance.

The scripts also upload the update's source maps to Sentry. Production refuses
to publish without `SENTRY_AUTH_TOKEN`; see [Sentry](sentry.md#phone-source-maps-and-symbols),
including how to retry a failed upload with `--upload-only`.

**A new build** — anything that changes the native surface: a new native
dependency, an `app.json` or config-plugin change, an Expo SDK bump. You do not
have to notice this yourself. The runtime version is a `fingerprint` hash of
exactly those inputs, so a native change produces a different fingerprint and
installed builds simply never see the update. They stay on the bundle they
shipped with rather than loading one their native code cannot run.

To see the current fingerprint, or why it moved:

```
pnpm exec expo-updates runtimeversion:resolve --platform android
pnpm exec eas fingerprint:compare
```

A fingerprint is mostly *paths*: 311 of this app's 316 fingerprint sources are
files under `node_modules/.pnpm/`. pnpm truncates those directory names to 60
characters on Windows and 120 on Linux, so the same commit used to resolve one
runtime version on a Windows machine and another on the EAS builder, and the build refused to
configure EAS Update. `virtualStoreDirMaxLength: 60` in `pnpm-workspace.yaml`
is what keeps the two honest. If a fingerprint ever splits between machines
again, suspect a path before you suspect a dependency.

`expo-updates` is inert in a debug build, so the dev client cannot verify any
of this; a release APK from `pnpm build:preview:android` (profile
`preview-internal`) can. Nothing under `src/` imports `expo-updates`.

### Watching a rollout

```
pnpm exec eas update:list --branch preview
pnpm exec eas branch:view preview
```

An update is downloaded in the background on the launch after it is published,
and runs on the launch after that. There is no prompt and no spinner: the app
has no update UI, by decision — [the mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#feedback) asks for silence,
and the cold-start window in `app/_layout.tsx` is already spoken for.

### When a bad update is out

Two panic buttons, in order of preference:

```
pnpm exec eas update:republish --branch preview --group <known-good-group-id>
pnpm exec eas update:roll-back-to-embedded --branch preview
```

`update:republish` puts a known-good update back on top of the branch and is
the right answer when a good one exists. `roll-back-to-embedded` sends every
build on the branch back to the bundle it was compiled with, and is the answer
when none does. Both take effect on the next launch, like any other update —
neither reaches out and fixes a phone that is sitting in someone's pocket.

### Channels

| Channel | Fed by | Built by |
| --- | --- | --- |
| `development` | `eas update --channel development --environment development` | `devbuild:android:eas` |
| `preview` | `pnpm update:preview` | `deploy:preview` (iOS, store), `build:preview:android` (APK) |
| `production` | `pnpm update:prod` | `deploy:prod` |

A channel is baked into a binary at build time and cannot be changed
afterwards. A build made without one — every gather binary produced before this
was set up — can never receive an update at all.

