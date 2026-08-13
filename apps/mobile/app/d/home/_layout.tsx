import { Stack } from 'expo-router'

/** A deep link landing here must have somewhere to go back to (#142). */
export const unstable_settings = { anchor: 'index' }

export default function HomeStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}
