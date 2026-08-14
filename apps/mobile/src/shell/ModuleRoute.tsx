import { moduleById } from '@gather/core/modules'
import { Redirect, useLocalSearchParams } from 'expo-router'

import { ModulePlaceholder } from '../components/ModulePlaceholder'

export function ModuleRoute({ fallback }: { fallback: '/all' | '/home' }) {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>()
  const module = moduleById(moduleId)

  if (!module) return <Redirect href={fallback} />

  return <ModulePlaceholder module={module} showHeader />
}
