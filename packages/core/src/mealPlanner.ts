export interface DinnerCandidate {
  id: string
  title: string
  prepMinutes?: number
}

/** Candidates a date may draw from; an unset limit means an ordinary dinner. */
export function eligibleDinnerCandidates(
  candidates: readonly DinnerCandidate[],
  quickLimit?: number,
): DinnerCandidate[] {
  if (quickLimit === undefined) return [...candidates]
  return candidates.filter(
    (candidate) =>
      candidate.prepMinutes !== undefined &&
      candidate.prepMinutes <= quickLimit,
  )
}

/** Pick a replacement without immediately repeating the dinner being replaced. */
export function randomDinner(
  candidates: readonly DinnerCandidate[],
  currentId?: string,
  random: () => number = Math.random,
): DinnerCandidate | undefined {
  const alternatives = candidates.filter(
    (candidate) => candidate.id !== currentId,
  )
  const pool = alternatives.length > 0 ? alternatives : candidates
  if (pool.length === 0) return undefined
  return pool[Math.floor(random() * pool.length)]
}
