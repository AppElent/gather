import { Stack } from 'expo-router'

/**
 * PROTOTYPE (#146) — shape F: one Stack, Home as the hub.
 *
 * No bottom bar at all. Everything is reached by pushing from Home, and the
 * back gesture is the only way back — which is the shape's whole question:
 * does a household app want a permanent bottom navigation, or is a hub enough?
 */
export const unstable_settings = { anchor: 'index' }

export default function VariantFLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}
