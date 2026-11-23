# Gather TV

The Apple TV app: a separate Expo app on `react-native-tvos`, sharing
`@gather/core` and the Convex API ([ADR-0052](../../docs/adr/0052-gather-tv-is-its-own-app-on-the-phones-app-store-record.md)).
It holds a placeholder screen; sign-in and the dashboard follow (APP-641).

## Run on an Apple TV simulator

```sh
pnpm --filter @gather/tv run prebuild   # writes ios/ (git-ignored)
pnpm --filter @gather/tv run ios        # builds and starts Metro on port 8094
```

## Before changing a dependency

A dependency here can move the phone's runtime fingerprint and cut installed
iPhone apps off over-the-air updates. Compare
`node apps/mobile/scripts/fingerprint.mjs` before and after, and read ADR-0052.

Known limits on `react-native-tvos` 0.88 (APP-642): `react-native-svg` fails
`pod install`, `useTVEventHandler` throws, `hasTVPreferredFocus` does not set the
initial focus, `Pressable` needs `focusable`, and its `focused` style state does
not fire, so keep focus in state with `onFocus` and `onBlur`.
