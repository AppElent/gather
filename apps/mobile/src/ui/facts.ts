/**
 * The facts a FactsStrip shows: two to four numbers about a record, each with
 * a unit word from `@gather/core` (`components/FactsStrip`).
 */
export interface Fact {
  /** The number, already formatted ("25", "4"). */
  value: string
  /** The unit word under it ("minutes", "servings"). */
  unit: string
}

export const MAX_FACTS = 4
export const MIN_FACTS = 2

/**
 * The facts worth a strip: those that exist, at most four. Fewer than two is
 * not a strip, so the record shows none rather than one lonely number.
 */
export function stripFacts(facts: readonly (Fact | null)[]): Fact[] {
  const present = facts.filter((fact): fact is Fact => fact !== null)
  if (present.length < MIN_FACTS) return []
  return present.slice(0, MAX_FACTS)
}

/** One VoiceOver element per cell: "25 minutes". */
export function factLabel(fact: Fact): string {
  return `${fact.value} ${fact.unit}`
}
