/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Which tab-bar treatment is on screen. A module-level store rather than a
 * `?variant=` search param because the thing being varied *is* the tab
 * navigator: a param lives on a route, and here the route tree itself is what
 * changes. `useSyncExternalStore` so the layout re-renders on a switch without
 * a provider wrapping the whole app.
 */
import { useSyncExternalStore } from 'react'

/**
 * Round two. The bar is settled — five slots, native, Profile owning its own
 * stack — so every variant here agrees about all of that and disagrees only
 * about **Add**. Variant A is retired: D beat it, and the Profile rows now
 * always push inside the tab.
 *
 * Ordered by how much of the platform's own furniture the treatment keeps,
 * most first. Cycling right is therefore cycling *away* from native, which
 * makes the trade legible as you go rather than after the fact.
 */
export const VARIANTS = ['D', 'E', 'F', 'C', 'B'] as const
export type Variant = (typeof VARIANTS)[number]

/** Shown in the switcher pill, so the thing on screen always has a name. */
export const VARIANT_NAMES: Record<Variant, string> = {
  D: 'Add is a place',
  E: 'Add is a native slot, opens sheet',
  F: 'Add in a native bottom accessory',
  C: 'Add is a floating pill',
  B: 'Add is a raised FAB, JS bar',
}

// D, because it is the one you have already seen: start on the known thing and
// cycle into the new ones.
let current: Variant = 'D'
const listeners = new Set<() => void>()

export function setVariant(next: Variant) {
  current = next
  for (const listener of listeners) listener()
}

export function cycleVariant(step: 1 | -1) {
  const index = VARIANTS.indexOf(current)
  setVariant(VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length])
}

export function useVariant(): Variant {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => current,
    () => current,
  )
}
