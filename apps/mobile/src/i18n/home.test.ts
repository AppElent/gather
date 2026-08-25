import { describe, expect, test } from 'vitest'

import { en } from './messages/en'
import { nl } from './messages/nl'

describe('Home introduction', () => {
  test('welcomes people and directs them to All in both supported locales', () => {
    expect(en.shell.home.intro).toBe(
      'Welcome to Gather. Find every module for this group in All.',
    )
    expect(nl.shell.home.intro).toBe(
      'Welkom bij Gather. Je vindt alle modules voor deze Groep bij Alles.',
    )
  })
})
