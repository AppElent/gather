import { describe, expect, test } from 'vitest'

import { APPLE_WEB_RETURN_URLS, appleWebReturnUrl } from '../appleSignIn'

describe('the web Apple return URL', () => {
  test("is production's Account page, the one registered with Apple", () => {
    expect(APPLE_WEB_RETURN_URLS).toEqual(['https://gather.appelent.nl/account'])
    expect(appleWebReturnUrl('https://gather.appelent.nl')).toBe(
      'https://gather.appelent.nl/account',
    )
  })

  test('is absent for every origin Apple does not know', () => {
    for (const origin of [
      'http://localhost:3000',
      'https://gather-stg.appelent.nl',
      'https://gather-pr-12.appelent.workers.dev',
      'https://gather.appelent.nl.evil.example',
    ])
      expect(appleWebReturnUrl(origin)).toBeNull()
  })
})
