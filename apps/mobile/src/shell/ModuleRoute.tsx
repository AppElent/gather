import { moduleById } from '@gather/core/modules'
import { Redirect, useLocalSearchParams } from 'expo-router'

import { ModulePlaceholder } from '../components/ModulePlaceholder'
import { isNativeModule, moduleDestination } from '../modules/moduleDestination'

/**
 * All's dynamic `[moduleId]` route: the placeholder for a Module with no
 * native screens yet.
 *
 * A Module that has screens can still arrive here — a hand-typed
 * `gather://all/<moduleId>` names the dynamic segment, not the static one — so
 * it is sent on to wherever `moduleDestination` says it lives rather than
 * drawing the placeholder over a Module that exists.
 */
export function ModuleRoute() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>()
  const module = moduleById(moduleId)

  if (!module) return <Redirect href="/all" />
  if (isNativeModule(module.id)) {
    return <Redirect href={moduleDestination(module.id)} />
  }
  return <ModulePlaceholder module={module} />
}
