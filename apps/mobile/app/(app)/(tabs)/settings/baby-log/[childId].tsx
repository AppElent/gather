import { Stack, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../../../../src/i18n'
import { ChildSettings } from '../../../../../src/modules/baby/ChildSettings'

export default function BabyLogChildSettings() {
  const { childId } = useLocalSearchParams<{ childId: string }>()
  const { t } = useI18n()

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.modules.byId['baby-log'].label }}
      />
      <ChildSettings childId={childId} />
    </>
  )
}
