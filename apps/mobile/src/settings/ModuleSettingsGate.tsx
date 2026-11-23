import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'

import { moduleShown } from '../modules/buildModules'
import type { ModuleSettingsId } from './module-pages'

/**
 * A Module settings page in the Settings stack, only while the Module is
 * shown. Settings › Modules leaves a hidden Module out, and a hand-typed
 * `gather://settings/<module>` must not open it either
 * (`modules/moduleVisibility.ts`, App Review 2.1(a)).
 */
export function ModuleSettingsGate({
  moduleId,
  children,
}: {
  moduleId: ModuleSettingsId
  children: ReactNode
}) {
  if (!moduleShown(moduleId)) return <Redirect href="/settings" />
  return children
}
