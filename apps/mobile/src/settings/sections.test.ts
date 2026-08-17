import { describe, expect, test } from 'vitest'

import { en } from '../i18n/messages/en'
import { nl } from '../i18n/messages/nl'
import { searchSettings, settingsSections } from './sections'

const sections = settingsSections(en, { appearance: 'dark', locale: 'en' })

const idsFor = (query: string) =>
  searchSettings(sections, query).map(({ entry }) => entry.id)

describe('the Settings list', () => {
  test('groups every setting under exactly one heading', () => {
    expect(
      sections.map(({ id, entries }) => [id, entries.map((e) => e.id)]),
    ).toEqual([
      ['account', ['account', 'groups']],
      ['phone', ['appearance', 'language']],
    ])
  })

  test('shows what the phone-local settings are currently set to', () => {
    const phone = sections[1].entries
    expect(phone.map(({ label, value }) => [label, value])).toEqual([
      ['Appearance', 'Dark'],
      [en.settings.language.title, 'English'],
    ])
  })

  test('leaves a row that is a place rather than a choice without a value', () => {
    expect(sections[0].entries.every(({ value }) => value === undefined)).toBe(
      true,
    )
  })
})

describe('searching the Settings list', () => {
  test('finds a setting by its label, whatever the casing', () => {
    expect(idsFor('LANG')).toEqual(['language'])
  })

  test('finds a setting by what it is set to, which is never its label', () => {
    expect(idsFor('dark')).toEqual(['appearance'])
  })

  test('finds every setting in a group by the name of the group', () => {
    expect(idsFor('this phone')).toEqual(['appearance', 'language'])
  })

  test('draws no conclusion from an empty or blank query', () => {
    expect(idsFor('')).toEqual([])
    expect(idsFor('   ')).toEqual([])
  })

  test('returns nothing rather than everything for a word it does not know', () => {
    expect(idsFor('bluetooth')).toEqual([])
  })

  test('searches the reader’s language, not English', () => {
    const dutch = settingsSections(nl, { appearance: 'dark', locale: 'nl' })
    expect(searchSettings(dutch, 'donker').map(({ entry }) => entry.id)).toEqual(
      ['appearance'],
    )
    expect(searchSettings(dutch, 'dark')).toEqual([])
  })
})
