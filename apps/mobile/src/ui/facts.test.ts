/**
 * A facts strip shows two to four numbers, each read out as one phrase
 * (`components/FactsStrip`).
 */
import { describe, expect, test } from 'vitest'

import { type Fact, factLabel, MAX_FACTS, stripFacts } from './facts'

const fact = (value: string, unit: string): Fact => ({ value, unit })

describe('stripFacts', () => {
  test('drops the facts a record does not have', () => {
    expect(
      stripFacts([fact('4', 'servings'), null, fact('6', 'steps')]),
    ).toEqual([fact('4', 'servings'), fact('6', 'steps')])
  })

  test('shows no strip for fewer than two facts', () => {
    expect(stripFacts([])).toEqual([])
    expect(stripFacts([fact('4', 'servings'), null, null])).toEqual([])
  })

  test('shows at most four', () => {
    const many = ['1', '2', '3', '4', '5'].map((n) => fact(n, 'units'))
    expect(stripFacts(many)).toHaveLength(MAX_FACTS)
    expect(stripFacts(many).map((each) => each.value)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })
})

test('factLabel reads the value and its unit as one phrase', () => {
  expect(factLabel(fact('25', 'minutes'))).toBe('25 minutes')
})
