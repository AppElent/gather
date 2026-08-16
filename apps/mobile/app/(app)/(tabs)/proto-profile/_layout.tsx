/**
 * PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
 *
 * The Profile tab's own stack, which is the whole point of variant **D**.
 *
 * The shipped app puts Account, Groups and Settings *above* the tabs, as
 * siblings of `(tabs)` in `app/(app)/_layout.tsx` — so pushing one covers the
 * tab bar (ADR-0015: anything that is not one of the fixed five sits above
 * them). That is correct for a gear on Home, which is a way out of the shell.
 * It reads differently once Profile is a permanent slot: you tap a destination
 * and everything it offers ejects you from the bar you just used.
 *
 * So this stack pushes them *inside* the tab instead. The bar survives, and you
 * can leave half-finished Settings for Search and come back to it.
 *
 * ## The three child routes are re-exports, not copies
 *
 * `account.tsx`, `groups.tsx` and `settings.tsx` here each re-export the real
 * screen from `app/(app)/`. Nothing is duplicated and nothing can drift, and it
 * makes the actual cost of this design visible rather than hiding it: the
 * screens now answer to **two addresses**, and only one of them keeps the bar.
 *
 * Watch for the seam that falls out of that, because it is the finding, not a
 * bug to fix here: the real Settings screen's own rows call
 * `router.push('/account')` — the flat address. So Profile → Settings keeps the
 * bar, and Settings → Account from inside it loses the bar again. Nesting a
 * screen means re-pointing every link *inside* it too, and that work does not
 * stop at the three files listed above.
 */
import { Stack } from 'expo-router'

import { useI18n } from '../../../../src/i18n'
import { useTokens } from '../../../../src/theme/tokens'

// Deep-linking straight to a child should leave the tab's own root beneath it,
// so the header's back button has somewhere to go.
export const unstable_settings = { anchor: 'index' }

export default function ProtoProfileLayout() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      {/* The tab's root draws its own heading, so it takes no native header —
          the same rule the five shipped tabs follow. The pushed children do
          take one, because a pushed screen needs the platform's back
          affordance. Their colours come from `NativeChrome`'s navigation
          theme, as in the root stack. */}
      <Stack.Screen name="index" />
      <Stack.Screen
        name="account"
        options={{ headerShown: true, title: t.account.title }}
      />
      <Stack.Screen
        name="groups"
        options={{ headerShown: true, title: t.shell.groups.title }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: true, title: t.settings.title }}
      />
    </Stack>
  )
}
