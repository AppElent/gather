/**
 * The Drop flow keeps its own stack so Back from stage two is stage one.
 *
 * That is the whole recovery story: a destination that refused the Drop leaves
 * the chooser exactly where it was, with the same Drop still pending, and no
 * destination has to grow an affordance for failing (ADR-0028).
 */
import { Stack } from 'expo-router'

import { useTokens } from '../../../src/theme/tokens'

export default function DropLayout() {
  const tokens = useTokens()
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    />
  )
}
