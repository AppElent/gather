import { isSmartListId } from '@gather/core/smart-lists'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { SmartList } from '../../../../../../src/modules/tasks/SmartListScreen'

export default function SmartListRoute() {
  const { smartList } = useLocalSearchParams<{ smartList: string }>()
  if (!isSmartListId(smartList)) return <Redirect href="/all/tasks" />
  return <SmartList id={smartList} />
}
