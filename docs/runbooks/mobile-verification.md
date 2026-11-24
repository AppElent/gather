---
type: runbook
description: Read when building, running, or verifying the phone app on a device or emulator, including a Release build on the simulator, store screenshots, a Drop and the quick-actions entry points.
version: 1.4.0
---

# Mobile verification

Binds the shared [verification](../standards/verification.md) standard, and
its device-automation loop, to `apps/mobile`. Checks to run first:
[verification](verification.md).

## Development build

The app runs on a development build, not on Expo Go. Expo Go ships a fixed set
of native modules and ignores config plugins, so it could never have run this
app's native surface — Clerk, SQLite, secure storage, image picking, and now
`expo-updates`. A development build removes that ceiling.

Build it once, from `apps/mobile`:

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
`pnpm devbuild:android:eas` (or `devbuild:ios:eas`) for a cloud build when you'd
rather not have a local toolchain.

The dev build also makes `gather-dev://` deep links real, so a screen can be opened
directly instead of tapped through.

## Driving the app (agent-device)

Emulator and app automation is not this repo's problem — it belongs to
[`agent-device`](https://github.com/callstack/agent-device), installed globally
and shared by every mobile project. Only the facts below are gather-specific.

| Fact | Value |
| --- | --- |
| Android app id | `com.appelent.gather.dev` (Expo Go: `host.exp.exponent`) |
| Deep link scheme | `gather-dev://` (dev build only) |
| Metro project root | `apps/mobile`; pnpm workspace, `--kind expo` |
| Default AVD | `Pixel_9_Pro` |

The loop, from a cold machine:

```
agent-device doctor                  # confirm the device and Metro are visible
agent-device boot                    # start the emulator if it isn't running
agent-device metro prepare --kind expo --project-root apps/mobile
agent-device open com.appelent.gather.dev --platform android --foreground
  press|fill|scroll <@ref> --settle  # each action prints the UI diff
  wait text "..."                    # this is verification; a screenshot is not
agent-device close
```

The UI is Dutch by default on a Dutch device, so a `text` selector matches
`Recepten`, not `Recipes`; add `testID` on screens you test often. The facts
above are Android's. On an iOS simulator (macOS with Xcode), use
`node scripts/run-mobile.mjs up` and `… ad <args>` ([mobile run](../standards/mobile-run.md);
Metro on port 8092, same bundle id `com.appelent.gather.dev`); `down` releases the simulator. A local build is the Dev variant
([ADR 0045](../adr/0045-each-build-variant-installs-beside-the-others.md)), so
it installs beside Gather Preview instead of replacing it.

## A Release build on the iOS simulator

Use it to see the app with no Metro: the embedded bundle, minified, `__DEV__`
off. It is still the Dev variant (`com.appelent.gather.dev`, development
Clerk and Convex), so it never needs a production secret. From the repository
root:

```
pnpm env:apply local --only file          # the bundle reads apps/mobile/.env.local
cd apps/mobile && APP_VARIANT=development pnpm exec expo prebuild --platform ios
cd ios && pod install
SENTRY_DISABLE_AUTO_UPLOAD=true xcodebuild -workspace GatherDev.xcworkspace \
  -scheme GatherDev -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build build
```

- **Keep signing on.** Do not pass `CODE_SIGNING_ALLOWED=NO`. A simulator
  build is signed ad hoc, and Xcode writes the app's entitlements into the
  binary's `__TEXT,__entitlements` section (`otool -l … | grep __entitlements`
  shows it). That is where the simulator reads the application identifier
  from. Without it the keychain refuses secure storage and Clerk cannot keep
  a session: signing in leaves you on the welcome screen. With signing on,
  you sign in and stay signed in across a relaunch.
- **No `.env.local`, no app.** Without the Clerk key the bundle throws at
  start, and `expo-updates` error recovery then aborts the app
  (`ErrorRecovery: could not recover from error, crashing` in
  `xcrun simctl spawn <udid> log show`).
- `SENTRY_DISABLE_AUTO_UPLOAD=true`: a local build has no Sentry auth token.

## Store screenshots

`apps/mobile/.maestro/store-screenshots.yaml` takes the App Store set, and
`store-screenshots.json` holds its labels per language. The shared
`store-screenshots.mjs` script in developer-home runs it on a 6.9" iPhone and a
13" iPad against the development client. From the repository root:

```
EXPO_PUBLIC_LIVE_MODULES_ONLY=1 node ~/Developer/developer-home/scripts/store-screenshots.mjs \
  --issue APP-123 --name gather [--devices iphone,ipad] [--langs en,nl]
```

`EXPO_PUBLIC_LIVE_MODULES_ONLY=1` makes the development client show only what
the store build shows (`src/modules/moduleVisibility.ts`). The flow signs in
with the dev shortcut, so the shots show the development test account's
Group; check every shot for an email address, a dev label or a LogBox toast
before anyone uploads it. Uploading is a separate, deliberate step.

## Watching query subscriptions

Start Metro with `EXPO_PUBLIC_DEBUG_QUERIES=1 pnpm start:dev-client` and every
query subscription the client opens or closes on the socket prints as
`[convex-query] + recipes:list` / `- recipes:list` in the Metro log. It is read
from the wire, so a screen that answers from retention prints nothing; a
reconnect re-adds every live query at once. Development builds only, off by
default. What the log should show for a tab return, backgrounding and
sign-out: [mobile query retention](../records/2026-10-18-mobile-query-retention.md).

## Verifying a Drop

For link and text Drops when nothing is open, the `gather-dev://drop` deep link
is the fast path — it lands on the chooser over the same `DropProvider`, with
the same ranking (ADR-0028):

```
agent-device open "gather-dev://drop?url=https://www.leukerecepten.nl/recepten/pasta/" --platform ios
agent-device open "gather-dev://drop?text=Buy%20stroopwafels" --platform ios
```

On the iOS simulator, Safari's share sheet can also be driven with
`agent-device` when you need a real share — for example, to verify that a Drop
closes an open sheet or waits for a prompt (the deep-link harness pushes the
chooser directly and does not exercise the share extension):

1. Open Safari (`agent-device open com.apple.mobilesafari`) and load a URL.
2. Tap Safari's Share button, then tap Gather's row in the OS share sheet using
   coordinate taps (`press <x> <y>`) — the share sheet's accessibility refs
   report stale frames, so snapshot refs miss the target.

A photo Drop has no deep-link harness — a route param cannot carry a file — so
the image destinations are verified by sharing a photo from the Photos app.

Two things the deep-link harness cannot tell you, and a real share can:

- **Whether Gather is in the sheet at all.** That is the config plugin, and it
  only exists after a build (`devbuild:android`). It is a native change, so it
  never arrives over the air (ADR-0029).
- **Whether an iOS image Drop is readable.** Shared files land in an App Group
  container the app must be entitled to read; get it wrong and the URI looks
  perfectly valid and reads as nothing.

## Verifying the quick-actions entry points

The app icon's quick actions and the Control Center control (APP-207) open
the same sheet as `<scheme>://quick`, so the sheet behind them is verified
with the link:

```
agent-device open "gather-dev://quick" --platform ios
agent-device open "gather-dev://quick?action=task-new" --platform ios   # the task form open
```

The entry points themselves belong to SpringBoard and Control Center, which
`agent-device` drives only as far as the screen goes: long-press the icon on
the Home Screen for the menu, and add the control from Control Center's edit
mode ("Add a Control", search for the app's name). Both need a development
build with the widget extension (`targets/widgets/`), and the menu appears only
after the app has launched once, because the app sets it from JavaScript in
its current language.

Test the control itself, not only the link: it reaches the app through its
user defaults rather than a URL (iOS drops a custom-scheme URL from a
control), so check both a cold start (quit the app first) and a tap with the
app in the background.

To fake a press without Control Center, write the press time into the app's
defaults as a plist `<real>`, in milliseconds:
`xcrun simctl spawn booted defaults write <bundle id> GatherQuickActionsControlRequestedAt "<real>$(($(date +%s) * 1000))</real>"`.
Not `-float`: it stores a 32-bit float, which rounds the time by up to about a
minute, often into the future, so the app drops the request as not fresh and
opens on Home (APP-459).
