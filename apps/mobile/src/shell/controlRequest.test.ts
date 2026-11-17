import { describe, expect, it } from 'vitest'

import {
  CONTROL_REQUEST_MAX_AGE_MS,
  isFreshControlRequest,
} from './controlRequest'

describe('isFreshControlRequest', () => {
  const now = 1_800_000_000_000

  it('takes a request made just now or within the limit', () => {
    expect(isFreshControlRequest(now, now)).toBe(true)
    expect(isFreshControlRequest(now - CONTROL_REQUEST_MAX_AGE_MS, now)).toBe(
      true,
    )
  })

  it('ignores a request older than the limit', () => {
    expect(
      isFreshControlRequest(now - CONTROL_REQUEST_MAX_AGE_MS - 1, now),
    ).toBe(false)
  })

  it('ignores a request from the future', () => {
    expect(isFreshControlRequest(now + 1, now)).toBe(false)
  })

  it('ignores anything that is not a time', () => {
    for (const value of [null, undefined, '1', Number.NaN, Infinity, {}]) {
      expect(isFreshControlRequest(value, now)).toBe(false)
    }
  })
})
