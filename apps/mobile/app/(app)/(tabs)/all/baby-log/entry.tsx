/**
 * One entry, mounted under all.
 *
 * The only screen in this Module the navigator presents as a sheet rather than
 * a push — see `EntryScreen` for why, and the stack layout for the options that
 * make it one.
 */
import { Stack } from 'expo-router'

import { EntryScreen } from '../../../../../src/modules/baby/EntryScreen'

export default function BabyLogEntry() {
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'card',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          sheetCornerRadius: 20,
          headerShown: false,
        }}
      />
      <EntryScreen />
    </>
  )
}
