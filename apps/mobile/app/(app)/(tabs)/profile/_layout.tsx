import { Stack } from 'expo-router'

import { useI18n } from '../../../../src/i18n'
import { useTokens } from '../../../../src/theme/tokens'

/** Profile owns utility pushes, so its tab remains available throughout them. */
export const unstable_settings = { anchor: 'index' }

export default function ProfileLayout() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
        name="settings"
        options={{ headerShown: true, title: t.settings.title }}
      />
    </Stack>
  )
}
