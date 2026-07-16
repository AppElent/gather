# Expo Mobile Foundation Design

## Goal

Create a first React Native app at `apps/mobile` that displays "Hello world" and establishes a small, reusable Expo foundation without introducing abstractions that have not yet earned their place.

## Scope

The first slice contains one Expo Router screen and a native stack layout. The app is named "Gather." It targets Android, iOS, and web through Expo, with Expo Go as the first development path.

This slice does not add tabs, forms, lists, remote data, state management, a UI library, a custom development client, or EAS configuration. Those should be introduced when a real feature requires them.

## Project Structure

The Expo project lives in `apps/mobile`, isolated from the existing Gather web app.

- `app/_layout.tsx` defines the root Expo Router `Stack` and native screen options.
- `app/index.tsx` renders the initial "Hello world" screen.
- `app.json` contains Expo configuration, enables the Expo Router plugin, follows the system color scheme, and enables typed routes.
- `assets/` contains the standard Expo app icons and splash assets generated for the project.
- `package.json` provides `start`, `android`, `ios`, `web`, and `typecheck` scripts.
- `tsconfig.json` extends Expo's TypeScript configuration and enables strict checking.

The initial screen keeps its styles close to the component so a new React Native developer can understand the complete screen in one file. Shared components or design tokens will be extracted only after a second use demonstrates a stable API.

## Native Defaults

Navigation uses Expo Router backed by a native stack. The initial route has the native header title "Gather," and screen content respects platform safe areas and automatic content insets.

Future features will use native-oriented primitives by default:

- Forms use platform-appropriate `TextInput`, switches, pickers, validation messages, and keyboard handling.
- Lists use `FlatList` or `SectionList` instead of mapping large collections into a scroll view.
- Loading states use `ActivityIndicator` with accessible status text when context is needed.
- Empty states clearly state what is missing and provide the next relevant action.
- Navigation remains file-based through Expo Router, using stack, modal, or tab patterns only when the workflow calls for them.

These are conventions for future work, not unused components in this first slice.

## Dependency Management

The repository continues to use pnpm as its package manager. Expo-compatible packages are selected and installed with `npx expo install` from `apps/mobile` so their versions match the installed Expo SDK. The generated app remains independently runnable from its own directory.

No package is added solely for potential future use.

## Runtime Behavior

Opening the app loads the root route and displays "Hello world" centered in the available screen area. There is no asynchronous data flow, persistence, or user input in this slice.

Because the screen has no fallible operations, it needs no custom error or loading state. Startup and bundling errors remain visible through Expo's standard development error UI.

## Verification

Verification proceeds in this order:

1. Run TypeScript checking with the mobile package's `typecheck` script.
2. Start Metro with `npx expo start` from `apps/mobile`.
3. Try the project in Expo Go first, using a physical device or available simulator/emulator.
4. Confirm the screen renders "Hello world" and Metro reports a successful bundle.
5. Use Expo's web target as an additional bundling smoke test when available.

A custom development client or EAS build is out of scope because the app uses only Expo Go-compatible modules. The implementation handoff must report the verification path actually completed and any unavailable device or simulator path honestly.

## Future Evolution

When real product screens introduce repeated controls and states, the next step is a small mobile UI layer containing proven components such as screen layout, buttons, fields, loading states, and empty states. When a second mobile app needs the same APIs, those stable components can move into a shared package such as `packages/mobile-ui`.

This sequence keeps the first app easy to learn while preserving a clear route toward reusable defaults across future apps.
