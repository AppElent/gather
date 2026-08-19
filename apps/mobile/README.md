# Gather mobile

Gather mobile is the native, connected-only companion to the Gather household
app. It shares the same Clerk account and Convex service as the web app.

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

The app runs in Expo Go today, which is fine until it isn't: Expo Go ships a
fixed set of native modules and ignores config plugins, so the first native
dependency that isn't already in it (barcode scanning, for one) ends the
arrangement. A development build removes that ceiling.

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
