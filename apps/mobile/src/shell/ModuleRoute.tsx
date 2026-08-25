import { moduleById } from '@gather/core/modules'
import { Redirect, useLocalSearchParams } from 'expo-router'

import { ModulePlaceholder } from '../components/ModulePlaceholder'
import { isNativeModule } from '../modules/moduleDestination'

export function ModuleRoute({ fallback }: { fallback: '/all' | '/home' }) {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>()
  const module = moduleById(moduleId)

  if (!module) return <Redirect href={fallback} />

  // A Module with real screens reached through the *dynamic* route — which is
  // what an addressed deep link produces (`shell/groupLink.ts`) — would render
  // the placeholder over a Module that exists. The tabs avoid this by naming
  // the static segment, but a link cannot, so the redirect lives here: one
  // place, consulted by both tabs, covering every Module as it lands.
  if (isNativeModule(moduleId)) {
    return <Redirect href={`${fallback}/${moduleId}` as never} />
  }

  return <ModulePlaceholder module={module} showHeader />
}
