# Building with gather mobile

These are **React Native** components (Expo), compiled for the browser through
react-native-web. Everything is on `window.GatherMobile`.

## Wrap everything, or nothing renders

`useTokens()` **throws** outside `AppearanceProvider` — a screen drawn in the
wrong scheme is a wiring bug, and failing loudly is deliberate. Use the provided
wrap:

```jsx
const G = window.GatherMobile

G.mount(document.getElementById('root'), G.h(YourScreen), { scheme: 'light' })
```

`mount(container, element, { scheme })` supplies `SafeAreaProvider` (with phone
metrics), `AppearanceProvider`, `LocaleProvider` and `AvailabilityProvider`.
`scheme` is `'light'` or `'dark'` and must be set *before* first render — the
appearance is read once, synchronously. To compose your own tree, wrap it in
`G.PreviewRoot` instead.

## There are no CSS classes — style through tokens

Never write `className`. Every colour comes from `useTokens()`, and layout comes
from React Native's `style` prop (flexbox, numbers not strings, no `px`).

```jsx
const tokens = G.useTokens()          // ink accent — no Module
const tokens = G.useTokens('kitchen') // the group's tint as the accent
```

`useTokens()` returns:

| Token | Meaning |
| --- | --- |
| `bg` | Screen background |
| `surface` | Cards, fields, raised things |
| `tile` | Recessed fills |
| `fg` | Primary text |
| `muted` | Secondary text, icons |
| `border` | Hairlines |
| `accent` | The one emphatic colour — see the accent rule |
| `onAccent` | Text/icons on `accent` |
| `danger` | Errors, destructive actions |
| `scheme` | `'light'` or `'dark'` |
| `tintOf(group)` | `{ bg, fg }` for a Module group |

**The accent rule.** `useTokens()` with no argument returns **ink** as the
accent, not a brand colour. Pass a Module group only when the surface genuinely
belongs to that Module. A tinted control on a group-less screen claims the reader
is somewhere they are not.

The four groups are `kitchen`, `money`, `home`, `tasting` — that is the whole
set, and it is what stops thirteen Modules reading as confetti.

Radii come from `RADIUS`: `RADIUS.tile` (13), `RADIUS.card` (16),
`RADIUS.control` (12). Use them rather than literals.

## Where the truth lives

- `styles.css` — page setup only. Component styling is **not** here:
  react-native-web injects it at runtime from `_ds_bundle.js`.
- `tokens/tokens.json` — every neutral, danger colour, radius and module tint,
  in both schemes, as data.
- `components/<group>/<Name>/<Name>.prompt.md` — how to use that component, with
  its rules. Read it before composing the component; several carry constraints
  that are not visible from the props (`SocialSoon` takes none on purpose,
  `GroupPending` deliberately has no retry, `ConnectionLostBanner` positions
  itself absolutely).
- `components/<group>/<Name>/<Name>.d.ts` — the prop contract.

## One idiomatic screen

`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`,
`ActivityIndicator` and `StyleSheet` are exported alongside the components —
use those for layout glue, not raw `div`/`span`, so the whole tree stays in one
layout model.

```jsx
const { h, useTokens, View, SettingsCard, SettingsRow, Segmented } = window.GatherMobile

function AppearanceScreen({ preference, setPreference }) {
  const tokens = useTokens()

  return h(
    View,
    { style: { backgroundColor: tokens.bg, padding: 20, flex: 1, gap: 14 } },
    h(
      SettingsCard,
      { title: 'Appearance', description: 'How gather looks on this phone.' },
      h(Segmented, {
        options: [
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
        value: preference,
        onChange: setPreference,
      }),
    ),
    h(
      SettingsCard,
      { title: 'Account' },
      h(SettingsRow, { label: 'Profile', onPress: () => {} }),
      h(SettingsRow, { label: 'Groups', onPress: () => {} }),
    ),
  )
}
```

Prefer a library component over your own: `SettingsCard` for any utility
surface, `AuthButton` for actions, `AuthField` for text entry, `Segmented` for a
small exclusive choice. Reach for raw elements only for layout glue between them.
