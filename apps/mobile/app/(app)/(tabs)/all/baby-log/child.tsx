import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../../../../src/i18n'
import { ChildSettings } from '../../../../../src/modules/baby/ChildSettings'

/** One Child's settings, pushed from Baby log settings or the child switcher. */
export default function BabyLogChildSettings() {
  const { childId } = useLocalSearchParams<{ childId?: string }>()
  const { t } = useI18n()
  if (!childId) return <Redirect href="/all/baby-log/settings" />

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.baby.log.child.settings }}
      />
      <ChildSettings childId={childId} />
    </>
  )
}
