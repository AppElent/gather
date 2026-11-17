---
type: runbook
description: Read when publishing an over-the-air update, making a store or internal build, or rolling an update back.
version: 2.0.0
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
asset: a screen, a string, a Convex query, an image in `assets/`. CI publishes
it; nobody needs to ([ADR 0044](../adr/0044-every-merge-ships-and-the-app-updates-daily.md)):

| Channel | When | Workflow | Skips, and says why in the run summary, when |
| --- | --- | --- | --- |
| `preview` | Every merge, after the production deploy | `mobile-update.yml` (called by `deploy.yml`) | Nothing bundled changed since `ota-preview`; or no update or build on `preview` has the fingerprint ("rebuild `preview-internal`") |
| `production` | Daily at 06:17 UTC | `mobile-update-production.yml` | No preview publish is 24 hours old yet; nothing bundled changed since `ota-production`; or no update or build on `production` has the fingerprint ("a store build is due") |

Both gates live in `apps/mobile/scripts/ota-gate.mjs`. The production job
publishes the newest commit whose Deploy run published it to preview at least
24 hours earlier and finished green, so the same JavaScript ran on the owner's
phone for a day and its backend is deployed. There is no decision card per
daily update. Its manual inputs `ref` (skip the soak selection, for a hotfix)
and `force` (skip the change and fingerprint gates) are used only after the
owner's yes on a decision card. After a production publish, check Sentry for
the new release; a regression is rolled back (below) and fixed forward.

Both jobs read `EXPO_TOKEN` from the `production` GitHub Environment, which
deploys from `main` only, written from Infisical `expo-token` by
`pnpm env:apply production --only github`. An Expo token can publish to any
channel, so it never lives in repository scope, where any branch's workflow
could read it. Without it the preview job warns and publishes nothing.

Each gate also refuses a commit that does not descend from the channel's tag,
so a re-run of an old Deploy run, or an older soaked commit after a hotfix,
never replaces newer code on phones. To hold production while a fix soaks,
disable the workflow (`gh workflow disable mobile-update-production.yml`) and
enable it again afterwards.

By hand, for example when CI is down, the same wrapper runs from the repo root:

```
pnpm mobile:update:preview    --message "what changed"
pnpm mobile:update:production --message "what changed"   # only with the owner's yes
```

Each runs `apps/mobile/scripts/publish-update.mjs` through `env:exec`, which adds the channel's EAS values (the Sentry token among
them) without writing a file; the wrapper pairs
`--channel` with `--environment`, as the
[mobile baseline](../standards/mobile-baseline.md#build-and-release-boundaries)
requires; publish only through it, in CI too. Here a bare publish would point
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

Every PR from a branch of this repository (Dependabot's included) that touches
`apps/mobile/`, `packages/`, `patches/`, the root `package.json`, the lockfile
or `pnpm-workspace.yaml` gets a **Mobile runtime** comment
(`.github/workflows/mobile-runtime.yml`) saying, per platform, whether the
native fingerprint changed. A "yes" means: after merging, make a new
`preview-internal` build; until then the preview update job skips that
platform. It also means the next store build: production stays on the old
JavaScript until a store build with the new fingerprint is out. The check never
fails a PR for a native change. A fork's PR gets no comment (its token is
read-only); the run summary has the same table.

To see the current fingerprint, or why it moved:

```
node apps/mobile/scripts/fingerprint.mjs          # from the repo root, both platforms
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

The CLI resolves the runtime version from your `node_modules`, while the build
resolves it from a fresh install of the committed lockfile. If your
`node_modules` is older than the lockfile, the two disagree and the build stops
at `CONFIGURE_EXPO_UPDATES` with "Runtime version mismatch". Before any build,
local or cloud, run `pnpm install` at the repo root, then run `pnpm exec eas`
from `apps/mobile`. From the repo root, `pnpm exec eas` silently falls back to
whatever global `eas` is installed instead of the version pinned in
`apps/mobile`. A leftover `apps/mobile/ios` or `android` folder from a
development build is gitignored and does not change the runtime version.

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
| `preview` | `mobile-update.yml` on every merge (by hand: `pnpm mobile:update:preview`) | `deploy:preview` (iOS, store), `build:preview:android` (APK) |
| `production` | `mobile-update-production.yml` daily (by hand: `pnpm mobile:update:production`) | `deploy:prod` |

Each base profile in `apps/mobile/eas.json` declares its own channel.
`preview-internal` extends `preview` and shares the `preview` channel, so it has
no row of its own and receives the same updates.

A channel is baked into a binary at build time and cannot be changed
afterwards. A build made without one — every gather binary produced before this
was set up — can never receive an update at all.


## Store builds and versions

A store build ships only for a native change, never on a schedule
([ADR 0044](../adr/0044-every-merge-ships-and-the-app-updates-daily.md)).
Native changes collect on `main`; the manager proposes one store build (at most
every two weeks unless a fix cannot wait) on a decision card with the
changelog, and builds and submits only after the owner's yes.

1. Confirm production Convex matches `main` and serves both the old and the
   new build.
2. Bump `expo.version` in `apps/mobile/app.json`: `MINOR` for a release,
   `PATCH` for a hotfix build. Build numbers stay with EAS
   (`appVersionSource: remote`, `autoIncrement`); never set them by hand.
3. Build and submit (`deploy:prod` from `apps/mobile`, or the hub's builds
   tool), then tag the commit `v<version>` and push the tag.
4. The changelog is the merged PR titles since the previous `v` tag; it goes on
   the decision card and in the GitHub release.
