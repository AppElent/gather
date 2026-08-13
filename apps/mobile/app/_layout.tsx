/**
 * PROTOTYPE (#146) — root layout.
 *
 * Four shell shapes live side by side under `/a`, `/b`, `/d` and `/f`. The
 * shell's own pages — the Group switcher sheet, You, Settings, Account,
 * Groups — sit here, above all four, because none of them belongs to a Group.
 */
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { ProtoProvider } from '../proto/state'
import { VariantBar } from '../proto/VariantBar'

/**
 * Without this the app opens on `switch-group`: a `Stack` takes its initial
 * route from the first screen it is *told* about, and the first `Stack.Screen`
 * in this file was the sheet. Found on the emulator, not by reading.
 */
export const unstable_settings = { anchor: 'index' }

export default function RootLayout() {
  return (
    <ProtoProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="switch-group"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.55, 1],
              sheetGrabberVisible: true,
              title: 'Switch Group',
            }}
          />
          <Stack.Screen name="you" options={{ headerShown: true }} />
          <Stack.Screen name="settings" options={{ headerShown: true }} />
          <Stack.Screen name="account" options={{ headerShown: true }} />
          <Stack.Screen name="groups" options={{ headerShown: true }} />
        </Stack>
        <VariantBar />
        <StatusBar style="auto" />
      </View>
    </ProtoProvider>
  )
}
