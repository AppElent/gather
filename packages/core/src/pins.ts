import { type ModuleDef, moduleById } from './modules'

export const DEFAULT_PINS: readonly string[] = ['recipes', 'tasks', 'nutrition']

export function pinnedModuleIds(stored?: readonly string[]): string[] {
  const source = stored ?? DEFAULT_PINS
  const ids: string[] = []
  for (const id of source) {
    if (ids.includes(id) || !moduleById(id)) continue
    ids.push(id)
  }
  return ids
}

export function pinnedModules(stored?: readonly string[]): ModuleDef[] {
  return pinnedModuleIds(stored).flatMap((id) => {
    const module = moduleById(id)
    return module ? [module] : []
  })
}

export function isPinned(stored: readonly string[] | undefined, id: string) {
  return pinnedModuleIds(stored).includes(id)
}

export function togglePin(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function movePin(
  ids: readonly string[],
  id: string,
  direction: 'up' | 'down',
): string[] {
  const from = ids.indexOf(id)
  if (from === -1) return [...ids]
  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= ids.length) return [...ids]

  const next = [...ids]
  next[from] = next[to]
  next[to] = id
  return next
}
