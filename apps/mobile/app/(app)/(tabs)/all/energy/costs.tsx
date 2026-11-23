import { useLocalSearchParams } from 'expo-router'

import { EnergyCostsScreen } from '../../../../../src/features/energy/energy-costs-screen'

/** `?month=YYYY-MM` opens that month; anything else opens this month. */
export default function EnergyCosts() {
  const { month } = useLocalSearchParams<{ month?: string }>()
  return (
    <EnergyCostsScreen
      initialMonth={month && /^\d{4}-\d{2}$/.test(month) ? month : undefined}
    />
  )
}
