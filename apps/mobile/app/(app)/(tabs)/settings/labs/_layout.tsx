import { Redirect, Stack } from 'expo-router'

import { useI18n } from '../../../../../src/i18n'
import { useTokens } from '../../../../../src/theme/tokens'

/**
 * Labs is a development build's alone, and this is the one place that says so.
 * Settings only lists the row in a development build; this guard is what keeps
 * a typed `gather://settings/labs/…` from reaching a prototype in a release.
 */
export default function LabsLayout() {
  const tokens = useTokens()
  const { t } = useI18n()

  if (!__DEV__) return <Redirect href="/settings" />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: 'minimal',
        headerLargeTitle: true,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: true, title: t.labs.title }}
      />
      <Stack.Screen
        name="calendar"
        options={{ headerShown: true, title: t.labs.calendar.title }}
      />
      <Stack.Screen name="finance" options={{ headerShown: false }} />
    </Stack>
  )
}
