# Gather mobile

Gather mobile is the native, connected-only companion to the Gather household
app. It shares the same Clerk account and Convex service as the web app.

## How this app behaves

Interaction rules — press-and-hold, swipe, haptics, sheets, undo, loading,
empty states — live in [`docs/mobile-interaction.md`](../../docs/mobile-interaction.md).
Read it before adding a screen. The research behind it is in
[`docs/research/mobile-interaction-vocabulary.md`](../../docs/research/mobile-interaction-vocabulary.md).

## Run locally

1. Copy `.env.example` to `.env.local` and provide the Clerk and Convex values.
2. From the repository root, run `pnpm --filter @gather/mobile start`.
3. Open the development build on a device, or start the Android or iOS target
   with `pnpm --filter @gather/mobile android` or
   `pnpm --filter @gather/mobile ios`.

The native app icon and launch mark are rendered from Gather's web favicon. A
native rebuild is required after changing `app.json` or anything in
`assets/images`.

## Development build

The app runs on a development build, not on Expo Go. Expo Go ships a fixed set
of native modules and ignores config plugins, so it could never have run this
app's native surface — Clerk, SQLite, secure storage, image picking, and now
`expo-updates`. A development build removes that ceiling.

Build it once, from this directory:

```
pnpm devbuild:android
```

That runs `expo run:android` — a local Gradle build that generates `android/`
(gitignored, disposable — `app.json` stays the source of truth), installs the
dev client on the running emulator, and starts Metro. First run takes roughly
five to ten minutes and needs a JDK 17+ on PATH, which Android Studio installs.

After that, every normal session is just:

```
pnpm start:dev-client
```

You only rebuild when native dependencies, `app.json`, or a config plugin
changes — never for JavaScript, which still Fast Refreshes. Use
`pnpm devbuild:android:clean` when a native change doesn't seem to take, or
`pnpm devbuild:android:eas` for a cloud build when you'd rather not have a local
Gradle toolchain (`eas build --local` is not an option on Windows).

The dev build also makes `gather://` deep links real, so a screen can be opened
directly instead of tapped through.

## Shipping a change

A change reaches installed builds one of two ways, and which one is not a
judgement call — `expo-updates` decides it mechanically. See
[ADR 0028](../../docs/adr/0028-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md).

**Over the air** — anything that is only JavaScript, TypeScript, or a bundled
asset: a screen, a string, a Convex query, an image in `assets/`. Publish it:

```
pnpm update:preview --message "what changed"
pnpm update:prod    --message "what changed"
```

Each script pairs `--channel` with `--environment`. **Never drop the
`--environment` flag.** `EXPO_PUBLIC_*` values are textually inlined into the
bundle by Metro at publish time (see `src/auth/config.ts`), so a publish without
it bakes in whatever `.env.local` the publishing machine happens to hold — which
would point production phones at the dev Convex deployment and the Clerk test
instance.

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
runtime version here and another on the EAS builder, and the build refused to
configure EAS Update. `virtualStoreDirMaxLength: 60` in `pnpm-workspace.yaml`
is what keeps the two honest. If a fingerprint ever splits between machines
again, suspect a path before you suspect a dependency.

### Watching a rollout

```
pnpm exec eas update:list --branch preview
pnpm exec eas branch:view preview
```

An update is downloaded in the background on the launch after it is published,
and runs on the launch after that. There is no prompt and no spinner: the app
has no update UI, by decision — `docs/mobile-interaction.md` asks for silence,
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
| `development` | `eas update --channel development` | `devbuild:android:eas` |
| `preview` | `pnpm update:preview` | `deploy:preview` (iOS, store), `build:preview:android` (APK) |
| `production` | `pnpm update:prod` | `deploy:prod` |

A channel is baked into a binary at build time and cannot be changed
afterwards. A build made without one — every gather binary produced before this
was set up — can never receive an update at all.

## Driving the app (agent-device)

Emulator and app automation is not this repo's problem — it belongs to
[`agent-device`](https://github.com/callstack/agent-device), installed globally
and shared by every mobile project. Only the facts below are gather-specific.

| Fact | Value |
| --- | --- |
| Android app id | `com.appelent.gather` (Expo Go: `host.exp.exponent`) |
| Deep link scheme | `gather://` (dev build only) |
| Metro project root | this directory; pnpm workspace, `--kind expo` |
| Default AVD | `Pixel_9_Pro` |

The loop, from a cold machine:

```
agent-device doctor                  # confirm the device and Metro are visible
agent-device boot                    # start the emulator if it isn't running
agent-device metro prepare --kind expo --project-root .
agent-device open com.appelent.gather --platform android --foreground
  press|fill|scroll <@ref> --settle  # each action prints the UI diff
  wait text "..."                    # this is verification; a screenshot is not
agent-device close
```

Two things that will bite: the UI is translated, so `text` selectors match
whatever locale is active (`Recepten`, not `Recipes`) — prefer `id` selectors and
add `testID` on screens you test often, since React Native maps `testID` to
Android's `resource-id`. And Apple targets are unavailable on Windows; iOS
verification needs a Mac or EAS's hosted simulators.
