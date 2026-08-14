import { nl } from '@gather/core/messages'
import { expect, test } from 'vitest'
import { refusalText } from './SaveAsCombo'

/**
 * `combos.saveFromMeal` throws a key, never a sentence, because the server has
 * no idea which language it is being read in (ADR-0011). These are the Dutch
 * resolutions, which is the case that actually regressed: an English refusal
 * built on the server reads as English to everybody.
 */
const combos = nl.nutrition.diary.combos

test('resolves a refusal key into the reader’s language', () => {
  expect(refusalText(new Error('comboNothingSelected'), combos)).toBe(
    'Vink minstens één item aan.',
  )
  expect(refusalText(new Error('comboComponentUnavailable'), combos)).toBe(
    'Iets hierin kan niet meer genoteerd worden, dus er is niets gewijzigd.',
  )
})

test('never puts an unrecognised failure on screen raw', () => {
  // A network blip, a bug, anything the server did not phrase for a reader:
  // the general refusal, in their language, rather than English internals.
  expect(refusalText(new Error('TypeError: fetch failed'), combos)).toBe(
    combos.saveFailed,
  )
  expect(refusalText('not an error at all', combos)).toBe(combos.saveFailed)
})
