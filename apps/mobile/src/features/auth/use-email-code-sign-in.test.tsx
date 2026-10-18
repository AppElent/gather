// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'
import {
  pickSecondFactor,
  type SecondFactorStep,
  useEmailCodeSignIn,
} from './use-email-code-sign-in'

const clerk = vi.hoisted(() => ({
  signIn: {
    status: 'needs_first_factor',
    supportedSecondFactors: [] as {
      strategy: string
      safeIdentifier?: string
    }[],
    reset: vi.fn(),
    finalize: vi.fn(),
    emailCode: { sendCode: vi.fn(), verifyCode: vi.fn() },
    mfa: {
      sendPhoneCode: vi.fn(),
      sendEmailCode: vi.fn(),
      verifyPhoneCode: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyTOTP: vi.fn(),
      verifyBackupCode: vi.fn(),
    },
  },
  errors: {
    fields: {} as Record<string, { code: string } | null>,
    global: null as { code: string }[] | null,
  },
}))

vi.mock('@clerk/expo', () => ({
  useSignIn: () => ({ signIn: clerk.signIn, errors: clerk.errors }),
}))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: en }) }))

const ok = { error: null }

type Hook = ReturnType<typeof useEmailCodeSignIn>

function renderHook() {
  const result = { current: undefined as unknown as Hook }
  function Probe() {
    result.current = useEmailCodeSignIn()
    return null
  }
  const view = mount(<Probe />)
  return { result, view }
}

/** Runs a hook call inside `act` and returns what it resolved with. */
async function run<T>(call: () => Promise<T>): Promise<T> {
  let value: T | undefined
  await act(async () => {
    value = await call()
  })
  return value as T
}

beforeEach(() => {
  vi.stubGlobal('__DEV__', false)
  clerk.signIn.status = 'needs_first_factor'
  clerk.signIn.supportedSecondFactors = []
  clerk.errors.fields = {}
  clerk.errors.global = null
  clerk.signIn.reset.mockResolvedValue(ok)
  clerk.signIn.finalize.mockResolvedValue(ok)
  clerk.signIn.emailCode.sendCode.mockResolvedValue(ok)
  clerk.signIn.mfa.sendPhoneCode.mockResolvedValue(ok)
  clerk.signIn.mfa.sendEmailCode.mockResolvedValue(ok)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('send', () => {
  test('starts clean, then sends to the trimmed address', async () => {
    const { result } = renderHook()
    const sent = await run(() => result.current.send('  a@b.com '))
    expect(sent).toBe(true)
    expect(clerk.signIn.reset).toHaveBeenCalledBefore(
      clerk.signIn.emailCode.sendCode,
    )
    expect(clerk.signIn.emailCode.sendCode).toHaveBeenCalledWith({
      emailAddress: 'a@b.com',
    })
    expect(result.current.busy).toBe(false)
  })

  test('a refused send stays put and says why, in the reader’s words', async () => {
    clerk.signIn.emailCode.sendCode.mockResolvedValue({
      error: { code: 'api_response_error' },
    })
    clerk.errors.fields = { identifier: { code: 'form_identifier_not_found' } }
    const { result } = renderHook()
    const sent = await run(() => result.current.send('nobody@b.com'))
    expect(sent).toBe(false)
    expect(result.current.error).toBe(en.errors.identifierNotFound)
  })

  test('an account without email codes gets the dedicated message', async () => {
    clerk.signIn.emailCode.sendCode.mockResolvedValue({
      error: { code: 'api_response_error' },
    })
    clerk.errors.global = [{ code: 'strategy_for_user_invalid' }]
    const { result } = renderHook()
    await run(() => result.current.send('a@b.com'))
    expect(result.current.error).toBe(en.errors.emailCodeUnavailable)
  })
})

describe('resend', () => {
  test('re-sends to the sign-in in progress, without an address', async () => {
    const { result } = renderHook()
    expect(await run(() => result.current.resend())).toBe(true)
    expect(clerk.signIn.emailCode.sendCode).toHaveBeenCalledWith()
  })

  test('ignores a second resend while one is in flight', async () => {
    let settleSend: (v: typeof ok) => void = () => {}
    clerk.signIn.emailCode.sendCode.mockReturnValue(
      new Promise((resolve) => {
        settleSend = resolve
      }),
    )
    const { result } = renderHook()
    let first: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      first = result.current.resend()
    })
    expect(result.current.resending).toBe(true)
    expect(await run(() => result.current.resend())).toBe(false)
    await act(async () => {
      settleSend(ok)
      await first
    })
    expect(clerk.signIn.emailCode.sendCode).toHaveBeenCalledTimes(1)
    expect(result.current.resending).toBe(false)
  })

  test('says "rate limited" when Clerk throttles the send', async () => {
    clerk.signIn.emailCode.sendCode.mockResolvedValue({
      error: { code: 'api_response_error' },
    })
    clerk.errors.global = [{ code: 'too_many_requests' }]
    const { result } = renderHook()
    await run(() => result.current.resend())
    expect(result.current.error).toBe(en.errors.tooManyRequests)
  })
})

describe('verify', () => {
  test('finalizes the session once the code is accepted', async () => {
    clerk.signIn.emailCode.verifyCode.mockImplementation(async () => {
      clerk.signIn.status = 'complete'
      return ok
    })
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(true)
    expect(clerk.signIn.emailCode.verifyCode).toHaveBeenCalledWith({
      code: '424242',
    })
    expect(clerk.signIn.finalize).toHaveBeenCalledOnce()
  })

  test('stays busy after finalize, because the screen is about to unmount', async () => {
    clerk.signIn.emailCode.verifyCode.mockImplementation(async () => {
      clerk.signIn.status = 'complete'
      return ok
    })
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    expect(result.current.busy).toBe(true)
  })

  test.each([
    ['form_code_incorrect', en.errors.codeIncorrect],
    ['verification_expired', en.errors.codeExpired],
    ['verification_failed', en.errors.codeExpired],
    ['too_many_requests', en.errors.tooManyRequests],
  ])('a %s failure never finalizes and reads as itself', async (code, message) => {
    clerk.signIn.emailCode.verifyCode.mockResolvedValue({
      error: { code: 'api_response_error' },
    })
    clerk.errors.fields = { code: { code } }
    const { result } = renderHook()
    expect(await run(() => result.current.verify('000000'))).toBe(false)
    expect(clerk.signIn.finalize).not.toHaveBeenCalled()
    expect(result.current.error).toBe(message)
    expect(result.current.busy).toBe(false)
  })

  test('a failed finalize is reported and releases the form', async () => {
    clerk.signIn.emailCode.verifyCode.mockImplementation(async () => {
      clerk.signIn.status = 'complete'
      return ok
    })
    clerk.signIn.finalize.mockResolvedValue({
      error: { code: 'network_error' },
    })
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(false)
    expect(result.current.error).toBe(en.errors.network)
    expect(result.current.busy).toBe(false)
  })

  test('a status we have no screen for is an honest error, not silence', async () => {
    clerk.signIn.emailCode.verifyCode.mockImplementation(async () => {
      clerk.signIn.status = 'needs_client_trust'
      return ok
    })
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(false)
    expect(clerk.signIn.finalize).not.toHaveBeenCalled()
    expect(result.current.error).toBe(en.errors.needsExtraStep)
    expect(result.current.busy).toBe(false)
  })
})

describe('second factor', () => {
  function needSecondFactor(
    factors: { strategy: string; safeIdentifier?: string }[],
  ) {
    clerk.signIn.supportedSecondFactors = factors
    clerk.signIn.emailCode.verifyCode.mockImplementation(async () => {
      clerk.signIn.status = 'needs_second_factor'
      return ok
    })
  }

  test('an authenticator code is asked for without sending anything', async () => {
    needSecondFactor([{ strategy: 'backup_code' }, { strategy: 'totp' }])
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(true)
    expect(result.current.secondFactor).toEqual<SecondFactorStep>({
      strategy: 'totp',
      contact: null,
    })
    expect(clerk.signIn.mfa.sendPhoneCode).not.toHaveBeenCalled()
    expect(clerk.signIn.finalize).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  test('a phone factor is sent a code and names where it went', async () => {
    needSecondFactor([{ strategy: 'phone_code', safeIdentifier: '+31•••12' }])
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    expect(clerk.signIn.mfa.sendPhoneCode).toHaveBeenCalledOnce()
    expect(result.current.secondFactor).toEqual({
      strategy: 'phone_code',
      contact: '+31•••12',
    })
  })

  test('a failed send still opens the second-factor step, with the error', async () => {
    needSecondFactor([{ strategy: 'phone_code', safeIdentifier: '+31•••12' }])
    clerk.signIn.mfa.sendPhoneCode.mockResolvedValue({
      error: { code: 'network_error' },
    })
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(false)
    expect(result.current.secondFactor).toEqual({
      strategy: 'phone_code',
      contact: '+31•••12',
    })
    expect(result.current.error).toBe(en.errors.network)
    expect(result.current.busy).toBe(false)
  })

  test('resend there retries the second factor, not the email code', async () => {
    needSecondFactor([{ strategy: 'phone_code', safeIdentifier: '+31•••12' }])
    clerk.signIn.mfa.sendPhoneCode.mockResolvedValueOnce({
      error: { code: 'network_error' },
    })
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    clerk.signIn.emailCode.sendCode.mockClear()

    expect(await run(() => result.current.resend())).toBe(true)
    expect(clerk.signIn.mfa.sendPhoneCode).toHaveBeenCalledTimes(2)
    expect(clerk.signIn.emailCode.sendCode).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  test('with nothing usable it says so instead of waiting', async () => {
    needSecondFactor([{ strategy: 'email_link' }])
    const { result } = renderHook()
    expect(await run(() => result.current.verify('424242'))).toBe(false)
    expect(result.current.error).toBe(en.errors.noSecondFactor)
    expect(result.current.secondFactor).toBeNull()
  })

  test('the second code completes and finalizes the session', async () => {
    needSecondFactor([{ strategy: 'totp' }])
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    clerk.signIn.mfa.verifyTOTP.mockImplementation(async () => {
      clerk.signIn.status = 'complete'
      return ok
    })
    expect(await run(() => result.current.verifySecondFactor(' 123456 '))).toBe(
      true,
    )
    expect(clerk.signIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: '123456' })
    expect(clerk.signIn.finalize).toHaveBeenCalledOnce()
  })

  test('each strategy is verified through its own call', async () => {
    needSecondFactor([{ strategy: 'backup_code' }])
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    clerk.signIn.mfa.verifyBackupCode.mockResolvedValue({
      error: { code: 'api_response_error' },
    })
    clerk.errors.fields = { code: { code: 'form_code_incorrect' } }
    expect(await run(() => result.current.verifySecondFactor('abcd'))).toBe(
      false,
    )
    expect(clerk.signIn.mfa.verifyBackupCode).toHaveBeenCalledWith({
      code: 'abcd',
    })
    expect(clerk.signIn.finalize).not.toHaveBeenCalled()
    expect(result.current.error).toBe(en.errors.codeIncorrect)
  })

  test('start over drops the second factor and resets the sign-in', async () => {
    needSecondFactor([{ strategy: 'totp' }])
    const { result } = renderHook()
    await run(() => result.current.verify('424242'))
    await run(() => result.current.startOver())
    expect(result.current.secondFactor).toBeNull()
    expect(clerk.signIn.reset).toHaveBeenCalled()
  })
})

describe('pickSecondFactor', () => {
  test('prefers an authenticator, then a texted code, then email, then a backup code', () => {
    const strategies = ['backup_code', 'email_code', 'phone_code', 'totp']
    const factors = strategies.map((strategy) => ({ strategy }))
    expect(pickSecondFactor(factors)?.strategy).toBe('totp')
    expect(pickSecondFactor(factors.slice(0, 3))?.strategy).toBe('phone_code')
    expect(pickSecondFactor(factors.slice(0, 2))?.strategy).toBe('email_code')
    expect(pickSecondFactor(factors.slice(0, 1))?.strategy).toBe('backup_code')
  })

  test('is undefined when only unsupported strategies are offered', () => {
    expect(pickSecondFactor([{ strategy: 'email_link' }])).toBeUndefined()
  })
})
