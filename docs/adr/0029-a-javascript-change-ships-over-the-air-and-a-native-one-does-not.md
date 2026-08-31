# A JavaScript change ships over the air, and a native one does not

Status: decided (2026-08-25)

## Decision

`apps/mobile` carries `expo-updates` with the `fingerprint` runtime-version
policy, and every EAS build profile declares a channel named after itself. A
JavaScript-only change is published to a channel and applied silently on the
next launch; a change to the native surface produces a different fingerprint and
is therefore never offered to a build that could not run it. The app gains no
update UI and no source file imports `expo-updates`.

Every publish pairs `--channel` with `--environment`, because `EXPO_PUBLIC_*`
values are inlined into the bundle at publish time rather than read at runtime.

## Consequences

A copy fix, a layout bug or a Convex query change reaches installed phones with
one command and no store review. A new native dependency, a config-plugin edit
or an SDK bump still requires a build, and says so by refusing to serve rather
than by shipping something broken.

`fallbackToCacheTimeout` is zero: the cold-start window in
`apps/mobile/app/_layout.tsx` holds the native splash while Clerk resolves, and
nothing else is allowed to race inside it. An update therefore takes two
launches — one to download, one to run — which is accepted in exchange for a
launch that never blocks on the network.

The channel is baked into a binary at build time, so a binary built before this
decision can never receive an update. Those installs are reachable only by a new
build.

## Enforcement

Mechanical, not remembered. Expo derives the runtime version by hashing the
native dependency set, the config plugins and the app config, so an incompatible
update cannot be published to an older build even by someone who has never read
this file. `eas fingerprint:compare` reports why a fingerprint moved.

The fingerprint is mostly paths, not contents — almost all of its sources are
files under `node_modules/.pnpm/`, whose directory names pnpm truncates to a
platform-dependent length. `virtualStoreDirMaxLength` is therefore pinned in
`pnpm-workspace.yaml`: without it a Windows checkout and the Linux builder
resolve different runtime versions from one commit, and the build fails rather
than shipping something unreachable.

The `--environment` pairing is enforced by only ever publishing through the
`update:preview` / `update:prod` scripts in `apps/mobile/package.json`, which
carry both flags.

`preview-internal` extends `preview` rather than replacing it, so the
store-distribution profile that feeds TestFlight keeps its behaviour.

## Reopen when

An update needs to apply within its own launch rather than the next one — which
would mean revisiting the splash-screen reasoning in `_layout.tsx` first — or
the fingerprint policy proves unstable between local and EAS builds in a way
that `.easignore` and fingerprint source overrides cannot settle, or rollouts
become worth configuring because there are enough users to stage a release
across.
