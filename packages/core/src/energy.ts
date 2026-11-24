/**
 * Energy (APP-491): what a home uses, produces and pays for electricity and
 * gas. Pure, dependency-free (ADR-0016), read by Convex and both clients.
 *
 * Only what the Module's shell needs lives here (APP-492). Prices, readings,
 * sources and solar each bring their own when they land (APP-493..496).
 */

/** Where a site's data comes from: the choice the empty Module's form offers. */
export const ENERGY_FIRST_SOURCES = ['homeAssistant', 'manual'] as const
export type EnergyFirstSource = (typeof ENERGY_FIRST_SOURCES)[number]

export const ENERGY_LIMITS = {
  /** A site's name: "Thuis", "Vakantiehuis". */
  siteName: 60,
} as const

export type EnergySiteNameProblem = 'needsName' | 'tooLong'

/** The name as it is stored, or why it cannot be. */
export function checkEnergySiteName(
  name: string,
): { name: string } | { problem: EnergySiteNameProblem } {
  const trimmed = name.trim()
  if (!trimmed) return { problem: 'needsName' }
  if (trimmed.length > ENERGY_LIMITS.siteName) return { problem: 'tooLong' }
  return { name: trimmed }
}

/**
 * The site the Module opens on: the Group's first by its own order, then the
 * oldest. A Group with several addresses picks one later (APP-492 shows one).
 */
export function primaryEnergySite<
  T extends { order: number; _creationTime: number },
>(sites: readonly T[]): T | undefined {
  return [...sites].sort(
    (a, b) => a.order - b.order || a._creationTime - b._creationTime,
  )[0]
}

export * from './energyHomeAssistant'
export * from './energyUsage'
