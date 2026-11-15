import { readLoyaltyCardRefusal } from '@gather/core/refusals'

/**
 * The sentence for a save Convex refused: its own reason when it gave one of
 * the Loyalty cards refusals, otherwise the plain "could not be saved".
 */
export function cardSaveProblem(
  error: unknown,
  words: {
    saveFailed: string
    refusals: Record<string, string>
  },
): string {
  const code = readLoyaltyCardRefusal(error)
  return (code && words.refusals[`loyalty:${code}`]) || words.saveFailed
}
