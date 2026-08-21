import { Stack } from 'expo-router'

import { useI18n } from '../../../../src/i18n'
import { useTokens } from '../../../../src/theme/tokens'

/**
 * Settings owns utility pushes, so its tab remains available throughout them
 * (ADR-0018, which is the ADR that actually makes this rule — ADR-0015 gets
 * cited for it and does not contain it).
 */
export const unstable_settings = { anchor: 'index' }

export default function SettingsLayout() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // See the note in home/_layout.tsx: iOS-only, and paired with
        // `contentInsetAdjustmentBehavior="automatic"` on each screen.
        headerLargeTitle: true,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
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
        name="appearance"
        options={{ headerShown: true, title: t.settings.appearance.title }}
      />
      <Stack.Screen
        name="language"
        options={{ headerShown: true, title: t.settings.language.title }}
      />
    </Stack>
  )
}
