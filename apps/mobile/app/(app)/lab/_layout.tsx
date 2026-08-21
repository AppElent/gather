/**
 * The sheet lab's own stack. Deleted with `src/lab/` once the sheet decision is
 * recorded in `docs/mobile-interaction.md`.
 *
 * Its own layout rather than four more screens in the app stack, so that
 * removing the lab is removing a directory.
 *
 * Each form-sheet variant is a separate screen because `presentation` and the
 * `sheet*` options are read at registration. Note none of these sheets contains
 * a nested navigator — that is the shape behind expo/expo#47831, and keeping
 * clear of it is deliberate.
 */
import { Stack } from 'expo-router'

import { useTokens } from '../../../src/theme/tokens'

export default function LabLayout() {
  const tokens = useTokens()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen name="sheets" />
      <Stack.Screen
        name="sheet-detents"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="sheet-fit"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="sheet-undimmed"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          sheetLargestUndimmedDetentIndex: 0,
        }}
      />
    </Stack>
  )
}
