# Prototype: where Home, the Pins, All and the Group switcher live (#146)

**Throwaway.** Everything under `proto/` and every route under `app/` except
`app/_layout.tsx` exists to answer one question on a device and is deleted when
#146 closes. Nothing here is a proposal for how the real app is structured —
the *decision* is, and it lands in the ticket's resolution.

## Run it

```bash
emulator -avd Pixel_9_Pro          # wait for boot
adb devices                        # must say `device`, not `unauthorized`
cd apps/mobile
npx expo start --android --port 8081
```

Never `CI=1` — it silently disables hot reload (#136).

## What is in it

Four shell shapes, live side by side, switchable from the pill on the right
edge of the screen. The pill is the prototype's own chrome and is not part of
any shape.

| | Shape | Bar | Pins live… |
| --- | --- | --- | --- |
| **A** | `NativeTabs`: Home · All | native | as content of Home |
| **B** | `NativeTabs`: Home · Recipes · Tasks · Nutrition · All | native | fixed in the bar, *and* on Home |
| **D** | `expo-router/ui` headless tabs, bar drawn by hand | drawn | in the bar, live from state |
| **F** | one `Stack`, Home as hub | none | on Home |

Shared by all four, at the root stack above them: the Group switcher sheet
(`/switch-group`), and You / Settings / Account / Groups, which belong to no
Group.

## What it fakes, and what it doesn't

- **No Convex, no Clerk, no i18n.** The Group list, the pins and the activity
  rows are in-memory fixtures in `proto/catalog.ts` and `proto/state.tsx`. The
  activity fixture has the shape `api.activity.forGroup` really returns.
- **The catalogue is real** — all thirteen Modules, their real EN labels and
  descriptions, hand-copied from `src/lib/` because `packages/core` (#143) does
  not exist yet.
- **The palette is real** — direction C from #144's accepted artifact, with
  ADR-0017's accent rule (`proto/tokens.ts`).
- **Icons are `@expo/vector-icons`' MaterialIcons**, standing in for the
  `lucide-react-native` map ADR-0017 chose. Already a scaffold dependency; the
  prototype installs nothing.
- **Navigation is real.** Native tabs, native stacks, a real `formSheet`, real
  safe-area insets, the real Android back button.

## Known prototype-only wrinkles

- In D, only Recipes, Tasks and Nutrition have routes, so only those three can
  appear in the drawn dock. A real build routes all thirteen.
- A Group switch resets pushed screens by having them pop themselves
  (`proto/screens/Module.tsx`); a real build resets the stacks directly.
