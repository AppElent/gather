import { describe, expect, it } from 'vitest'
import {
  clerkErrorMessage,
  emailCodeErrorKey,
  shouldShowTestLogin,
} from './core'

describe('shouldShowTestLogin', () => {
  it('is false on a live key even with creds present', () => {
    expect(
      shouldShowTestLogin({
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_live_x',
        VITE_TEST_USER_EMAIL: 'test@test.com',
        VITE_TEST_USER_PASSWORD: 'secret',
      }),
    ).toBe(false)
  })

  it('is false on a test key with no creds', () => {
    expect(
      shouldShowTestLogin({
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      }),
    ).toBe(false)
  })

  it('is false on a test key with only one of the two creds', () => {
    expect(
      shouldShowTestLogin({
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
        VITE_TEST_USER_EMAIL: 'test@test.com',
      }),
    ).toBe(false)
    expect(
      shouldShowTestLogin({
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
        VITE_TEST_USER_PASSWORD: 'secret',
      }),
    ).toBe(false)
  })

  it('is false with no publishable key at all', () => {
    expect(
      shouldShowTestLogin({
        VITE_TEST_USER_EMAIL: 'test@test.com',
        VITE_TEST_USER_PASSWORD: 'secret',
      }),
    ).toBe(false)
  })

  it('is true only when both a test key and both creds are present', () => {
    expect(
      shouldShowTestLogin({
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
        VITE_TEST_USER_EMAIL: 'test@test.com',
        VITE_TEST_USER_PASSWORD: 'secret',
      }),
    ).toBe(true)
  })
})

describe('clerkErrorMessage', () => {
  it("extracts the first error's longMessage when present", () => {
    const err = { errors: [{ longMessage: 'Long', message: 'Short' }] }
    expect(clerkErrorMessage(err)).toBe('Long')
  })

  it('falls back to message when longMessage is absent', () => {
    expect(clerkErrorMessage({ errors: [{ message: 'Short' }] })).toBe('Short')
  })

  it('falls back to the default message for non-Clerk errors', () => {
    expect(clerkErrorMessage(new Error('boom'))).toBe('Something went wrong.')
    expect(clerkErrorMessage(undefined)).toBe('Something went wrong.')
  })

  it('accepts a custom fallback', () => {
    expect(clerkErrorMessage(undefined, 'Custom fallback')).toBe(
      'Custom fallback',
    )
  })
})

describe('emailCodeErrorKey', () => {
  const withCode = (code: string) => ({ errors: [{ code }] })

  it('classifies the failures a person can act on', () => {
    expect(emailCodeErrorKey(withCode('form_code_incorrect'))).toBe(
      'codeIncorrect',
    )
    expect(emailCodeErrorKey(withCode('verification_expired'))).toBe(
      'codeExpired',
    )
    expect(emailCodeErrorKey(withCode('verification_failed'))).toBe(
      'codeExpired',
    )
    expect(emailCodeErrorKey(withCode('too_many_requests'))).toBe('rateLimited')
    expect(emailCodeErrorKey({ status: 429 })).toBe('rateLimited')
  })

  it('leaves anything else to the Clerk message', () => {
    expect(emailCodeErrorKey(withCode('form_identifier_not_found'))).toBe(
      undefined,
    )
    expect(emailCodeErrorKey(new Error('boom'))).toBe(undefined)
    expect(emailCodeErrorKey(undefined)).toBe(undefined)
  })
})
