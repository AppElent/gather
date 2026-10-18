---
type: runbook
description: Read when building, running, or verifying the phone app on a device or emulator, including a Drop.
version: 1.2.0
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
| Metro project root | `apps/mobile`; pnpm workspace, `--kind expo` |
| Default AVD | `Pixel_9_Pro` |

The loop, from a cold machine:

```
agent-device doctor                  # confirm the device and Metro are visible
agent-device boot                    # start the emulator if it isn't running
agent-device metro prepare --kind expo --project-root apps/mobile
agent-device open com.appelent.gather --platform android --foreground
  press|fill|scroll <@ref> --settle  # each action prints the UI diff
  wait text "..."                    # this is verification; a screenshot is not
agent-device close
```

The UI is Dutch by default on a Dutch device, so a `text` selector matches
`Recepten`, not `Recipes`; add `testID` on screens you test often. The facts
above are Android's; an iOS simulator needs macOS with Xcode, and the bundle id
is the same `com.appelent.gather`.

## Watching query subscriptions

Start Metro with `EXPO_PUBLIC_DEBUG_QUERIES=1 pnpm start:dev-client` and every
query subscription the client opens or closes on the socket prints as
`[convex-query] + recipes:list` / `- recipes:list` in the Metro log. It is read
from the wire, so a screen that answers from retention prints nothing; a
reconnect re-adds every live query at once. Development builds only, off by
default. What the log should show for a tab return, backgrounding and
sign-out: [mobile query retention](../records/2026-10-18-mobile-query-retention.md).

## Verifying a Drop

The share sheet cannot be automated. `agent-device` drives Gather, not Safari,
and the OS sheet belongs to neither — so the Drop flow (ADR-0028) is verified
through a deep link that produces the same Drop the share sheet would:

```
agent-device deeplink "gather://drop?url=https://www.leukerecepten.nl/recepten/pasta/"
agent-device deeplink "gather://drop?text=Buy%20stroopwafels"
```

Both land on the chooser, over the same `DropProvider`, with the same ranking.
A photo Drop has no harness — a route param cannot carry a file — so the image
destinations are verified by sharing a photo by hand from the gallery app.

Two things this harness cannot tell you, and a real share can:

- **Whether Gather is in the sheet at all.** That is the config plugin, and it
  only exists after a build (`devbuild:android`). It is a native change, so it
  never arrives over the air (ADR-0029).
- **Whether an iOS image Drop is readable.** Shared files land in an App Group
  container the app must be entitled to read; get it wrong and the URI looks
  perfectly valid and reads as nothing.
