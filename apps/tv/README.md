# Gather TV

The Apple TV app: a separate Expo app on `react-native-tvos`, sharing
`@gather/core` and the Convex API ([ADR-0052](../../docs/adr/0052-gather-tv-is-its-own-app-on-the-phones-app-store-record.md)).
It holds a placeholder screen; sign-in and the dashboard follow (APP-641).

## Run on an Apple TV simulator

```sh
pnpm --filter @gather/tv run prebuild   # writes ios/ (git-ignored)
pnpm --filter @gather/tv run ios        # builds and starts Metro on port 8094
```

## EAS profiles

The app has its own EAS project, `@appelent/gather-tv`, separate from the
phone's (APP-860). expo-updates reports tvOS as `ios`, so a shared project would
keep a TV update off phones only by channel and runtime; a separate project and
update URL rule it out. The project also keeps its own remote build number, and
tvOS has its own build train in App Store Connect, so it cannot clash with the
phone.

| Profile | Build | Channel |
| --- | --- | --- |
| `development` | simulator, Debug | `development` |
| `preview` | store, `com.appelent.gather.preview` | `preview` |
| `production` | store, `com.appelent.gather` | `production` |

No profile has been built yet; the first build, its credentials and the OTA job
belong to APP-648. `scripts/tv-isolation.test.ts` checks the project, update URL
and channels.

## Before changing a dependency

A dependency here can move the phone's runtime fingerprint and cut installed
iPhone apps off over-the-air updates. Compare
`node apps/mobile/scripts/fingerprint.mjs` before and after, and read ADR-0052.

Known limits on `react-native-tvos` 0.88 (APP-642): `react-native-svg` fails
`pod install`, `useTVEventHandler` throws, `hasTVPreferredFocus` does not set the
initial focus, `Pressable` needs `focusable`, and its `focused` style state does
not fire, so keep focus in state with `onFocus` and `onBlur`.
