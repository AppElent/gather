import { Redirect, Stack } from 'expo-router'

export default function FinanceLabLayout() {
  if (!__DEV__) return <Redirect href="/settings" />
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }} />
}
