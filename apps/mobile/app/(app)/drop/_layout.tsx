/**
 * The Drop flow keeps its own stack so Back from stage two is stage one.
 *
 * That is the whole recovery story: a destination that refused the Drop leaves
 * the chooser exactly where it was, with the same Drop still pending, and no
 * destination has to grow an affordance for failing (ADR-0028).
 *
 * The chooser is singular: a second share, or `gather-dev://drop`, while one is
 * open brings that one back to the top rather than stacking another over it
 * (APP-734). It reads the pending Drop, so a replacing share shows there.
 */
import { Stack } from 'expo-router'

import { useTokens } from '../../../src/theme/tokens'

export default function DropLayout() {
  const tokens = useTokens()
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: tokens.ground },
      }}
    >
      <Stack.Screen name="index" dangerouslySingular />
    </Stack>
  )
}
