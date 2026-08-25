import { describe, expect, test } from 'vitest'

import { eligibleDinnerCandidates, randomDinner } from './mealPlanner'

const candidates = [
  { id: 'slow', title: 'Slow roast', prepMinutes: 90 },
  { id: 'quick', title: 'Penne carbonara', prepMinutes: 20 },
  { id: 'unknown', title: 'Leftovers' },
]

describe('meal planner policy', () => {
  test('quick days exclude un-timed and slower dinners', () => {
    expect(eligibleDinnerCandidates(candidates, 20)).toEqual([
      { id: 'quick', title: 'Penne carbonara', prepMinutes: 20 },
    ])
  })

  test('an ordinary day may use every dinner', () => {
    expect(eligibleDinnerCandidates(candidates)).toEqual(candidates)
  })

  test('random dinner excludes the current dinner when another candidate exists', () => {
    expect(randomDinner(candidates, 'quick', () => 0)).toEqual(candidates[0])
  })
})
