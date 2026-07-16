# Expo Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an Expo Router app at `apps/mobile` that displays "Hello world" and runs in Expo Go without a custom native build.

**Architecture:** The mobile app is a pnpm workspace package nested inside the existing repository and runnable from its own directory. The scaffolded Expo Router app is reset with Expo's generated reset script, then the default route is reduced to the "Hello world" first screen.

**Tech Stack:** Expo SDK 54 compatibility path, Expo Router, React Native, TypeScript, pnpm

## Global Constraints

- The app lives at `apps/mobile` and does not modify the existing Gather web app.
- Register `apps/*` in the existing pnpm workspace without weakening its dependency or lifecycle-script policies.
- The app is named "Gather."
- Expo Router and file-based routes are required from the first slice.
- Metro starts with `npx expo start`, and Expo Go is attempted before any custom development build.
- Expo packages are installed with `npx expo install` so versions match the generated Expo SDK.
- The project uses strict TypeScript and typed Expo Router routes.
- The UI follows the system light or dark appearance and respects native safe-area insets.
- The initial route displays "Hello world" centered in the available screen area.
- Do not add tabs, forms, lists, remote data, state management, a UI library, a custom development client, or EAS configuration.
- Do not add a unit-test framework for this static slice; verify it through type checking, linting, bundling, and runtime rendering.

---

### Task 1: Expo Router Hello World Slice

**Files:**

- Create from reset scaffold: `apps/mobile/app/_layout.tsx`
- Modify from reset scaffold: `apps/mobile/app/index.tsx`
- Create from scaffold: `apps/mobile/.gitignore`
- Create from scaffold: `apps/mobile/assets/`
- Create from scaffold: `apps/mobile/eslint.config.js`
- Create from scaffold: `apps/mobile/expo-env.d.ts`
- Modify from scaffold: `apps/mobile/app.json`
- Modify from scaffold: `apps/mobile/package.json`
- Modify from scaffold: `apps/mobile/tsconfig.json`
- Modify: `pnpm-workspace.yaml`
- Modify from dependency installation: `pnpm-lock.yaml`
- Delete after reset: `apps/mobile/app-example/` and `apps/mobile/scripts/`

**Interfaces:**

- Consumes: Expo Router's scaffolded root layout and the reset route's React Native screen primitives.
- Produces: `RootLayout(): React.JSX.Element` as the root router layout and `HomeScreen(): React.JSX.Element` as the `/` route.

- [ ] **Step 1: Confirm the destination is available**

Run from the repository root:

```powershell
git status --short
Test-Path apps/mobile
```

Expected: Git reports only the implementation-plan file as new, and `Test-Path` prints `False`.

- [ ] **Step 2: Register mobile apps in the pnpm workspace**

Add this block at the beginning of `pnpm-workspace.yaml`, before the existing `allowBuilds` policy:

```yaml
packages:
  - "apps/*"
```

Expected: the existing `allowBuilds`, `minimumReleaseAge`, `minimumReleaseAgeExclude`, and `overrides` configuration remains unchanged below the new package glob.

- [ ] **Step 3: Scaffold the Expo Go-compatible default project with pnpm**

Run from the repository root:

```powershell
pnpm create expo-app@latest apps/mobile --yes --no-agents-md
```

Expected: `create-expo-app` reports that the project is ready. During the current Expo SDK 57 transition, the command's default creates the SDK 54 project intended for Expo Go on physical devices.

- [ ] **Step 4: Align required Expo packages with the generated SDK**

Run from `apps/mobile`:

```powershell
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-system-ui
npx expo install react-native-web react-dom
```

Expected: Expo selects SDK-compatible versions and pnpm completes without peer-dependency errors.

- [ ] **Step 5: Reset the generated starter UI**

Run from `apps/mobile`:

```powershell
pnpm reset-project
```

Expected: Expo's generated reset script moves the rich starter UI into `app-example/` and leaves a simple `app/` directory with a default route.

Then remove the archived example and reset script, because this repository keeps only the starter slice it actually uses:

```powershell
Resolve-Path .
Remove-Item -Recurse -Force -LiteralPath app-example, scripts
```

Expected: the resolved path ends with `gather\apps\mobile`, the simple reset `app/` remains, and the archived example source is gone.

- [ ] **Step 6: Configure the mobile package entry point and scripts**

Run from `apps/mobile`:

```powershell
pnpm pkg set "name=@gather/mobile" "main=expo-router/entry" "scripts.start=expo start" "scripts.android=expo start --android" "scripts.ios=expo start --ios" "scripts.web=expo start --web" "scripts.typecheck=tsc --noEmit"
pnpm pkg set private=true --json
pnpm pkg delete scripts.reset-project
```

Expected package fields:

```json
{
  "name": "@gather/mobile",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit"
  }
}
```

The scaffolded `dependencies` and `devDependencies` remain in the same file with the versions selected by Expo.

- [ ] **Step 7: Update the Expo app configuration**

Set `apps/mobile/app.json` to this small deterministic configuration:

```json
{
  "expo": {
    "name": "Gather",
    "slug": "gather",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "gather",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "edgeToEdgeEnabled": true
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": ["expo-router", "expo-system-ui"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 8: Enable strict TypeScript and generated route types**

Set `apps/mobile/tsconfig.json` to:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 9: Keep the reset native stack layout**

Confirm the reset layout at `apps/mobile/app/_layout.tsx` is equivalent to:

```tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Gather" }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
```

- [ ] **Step 10: Change the reset route text to Hello World**

Replace the reset route at `apps/mobile/app/index.tsx` with:

```tsx
import { ScrollView, StyleSheet, Text, useColorScheme } from "react-native";

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={isDark ? styles.screenDark : styles.screenLight}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}
      >
        Hello world
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  screenLight: {
    backgroundColor: "#f7f7f8",
  },
  screenDark: {
    backgroundColor: "#101114",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
  },
  titleLight: {
    color: "#171717",
  },
  titleDark: {
    color: "#f5f5f5",
  },
});
```

- [ ] **Step 11: Verify configuration and static correctness**

Run from `apps/mobile`:

```powershell
pnpm typecheck
pnpm lint
npx expo install --check
npx expo config --type public
```

Expected: type checking and linting exit successfully, Expo reports dependencies are up to date, and the public config shows `name: Gather`, `scheme: gather`, the Router plugin, and typed routes enabled.

- [ ] **Step 12: Verify the universal bundle**

Run from `apps/mobile`:

```powershell
npx expo export --platform web --output-dir dist
```

Expected: Metro completes the web bundle and exports the `/` route without module-resolution errors. The generated `dist/` directory remains ignored by Git.

- [ ] **Step 13: Verify Expo Go first**

Run from `apps/mobile`:

```powershell
npx expo start --clear
```

Expected: Metro displays an Expo Go QR code. Open it in Expo Go on an available physical device and confirm a native header titled "Gather" with centered "Hello world" content. If no physical device is available, try `A` for an installed Android emulator; use `W` only as the additional browser smoke test. Do not create a development client or EAS build for this slice.

- [ ] **Step 14: Review and commit the slice**

Run from the repository root:

```powershell
git status --short
git diff --check
git diff -- apps/mobile pnpm-workspace.yaml pnpm-lock.yaml docs/superpowers/plans/2026-07-15-expo-mobile-foundation.md
git add apps/mobile pnpm-workspace.yaml pnpm-lock.yaml docs/superpowers/plans/2026-07-15-expo-mobile-foundation.md
git commit -m "feat: add Expo mobile hello world"
```

Expected: only the mobile app, pnpm workspace metadata, and this plan are committed. The final handoff reports the exact Expo Go, device, emulator, web, or bundling path actually completed.
