import { Redirect, useLocalSearchParams } from 'expo-router'
import { BabyLogSettingsScreen } from '../../../../../src/modules/baby/BabyLogSettingsScreen'
import { moduleHref } from '../../../../../src/modules/moduleDestination'

/**
 * Baby log settings, behind the Module's gear (APP-611). Until APP-611 this
 * address was one Child's settings (`?childId=`); a link from then still
 * lands on that Child, now at `child`.
 */
export default function BabyLogSettingsRoute() {
  const { childId } = useLocalSearchParams<{ childId?: string }>()
  if (childId)
    return <Redirect href={moduleHref('/all/baby-log/child', { childId })} />
  return <BabyLogSettingsScreen door="all" />
}
