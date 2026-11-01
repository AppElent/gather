import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * A Clerk Core 3 `signIn`: every step resolves to `{ error }`, and the
 * attempt's state (status, factors) is read back from the resource.
 */
type Step = ReturnType<typeof vi.fn>
const ok = () => Promise.resolve({ error: null })
const signIn = {
  status: null as string | null,
  supportedFirstFactors: [] as unknown[],
  supportedSecondFactors: [] as unknown[],
  create: vi.fn() as Step,
  password: vi.fn() as Step,
  emailCode: { sendCode: vi.fn() as Step, verifyCode: vi.fn() as Step },
  mfa: {
    sendPhoneCode: vi.fn() as Step,
    sendEmailCode: vi.fn() as Step,
    verifyPhoneCode: vi.fn() as Step,
    verifyEmailCode: vi.fn() as Step,
    verifyTOTP: vi.fn() as Step,
    verifyBackupCode: vi.fn() as Step,
  },
  finalize: vi.fn() as Step,
  reset: vi.fn() as Step,
}
const steps = [
  signIn.create,
  signIn.password,
  signIn.emailCode.sendCode,
  signIn.emailCode.verifyCode,
  ...Object.values(signIn.mfa),
  signIn.finalize,
  signIn.reset,
]
const emailCodeFactors = [{ strategy: 'email_code', emailAddressId: 'idn_1' }]

/** A step that succeeds and leaves the attempt in `state`. */
function resolvesTo(step: Step, state: Partial<typeof signIn>) {
  step.mockImplementation(async () => {
    Object.assign(signIn, state)
    return { error: null }
  })
}

function resetSignIn() {
  signIn.status = null
  signIn.supportedFirstFactors = []
  signIn.supportedSecondFactors = []
  for (const step of steps) {
    step.mockReset()
    step.mockImplementation(ok)
  }
}
resetSignIn()

vi.mock('@clerk/react', () => ({
  useSignIn: () => ({ signIn, errors: {}, fetchStatus: 'idle' }),
}))

import { renderWithI18n } from '../i18n/testing'
import { AuthConfigProvider } from './AuthConfigProvider'
import { SignInForm } from './SignInForm'

function renderForm(onSuccess = vi.fn(), locale: 'en' | 'nl' = 'en') {
  return renderWithI18n(
    <AuthConfigProvider>
      <SignInForm onSuccess={onSuccess} />
    </AuthConfigProvider>,
    { locale },
  )
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** Types an email, asks for a code and waits for the code step. */
async function reachCodeStep(onSuccess = vi.fn()) {
  resolvesTo(signIn.create, { supportedFirstFactors: emailCodeFactors })
  renderForm(onSuccess)
  type('Email', 'a@b.com')
  fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
  await screen.findByLabelText('Code')
  return onSuccess
}

function clerkError(code: string, message = 'clerk says no', status = 422) {
  return { status, errors: [{ code, message }] }
}

describe('SignInForm', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    resetSignIn()
  })

  describe('password', () => {
    it('submits credentials and activates the session', async () => {
      resolvesTo(signIn.password, { status: 'complete' })
      const onSuccess = vi.fn()
      renderForm(onSuccess)
      type('Email', 'a@b.com')
      type('Password', 'pw')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled())
      expect(signIn.password).toHaveBeenCalledWith({
        identifier: 'a@b.com',
        password: 'pw',
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('shows a readable error on failure', async () => {
      signIn.password.mockResolvedValue({
        error: { errors: [{ message: 'Invalid.' }] },
      })
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      expect(await screen.findByText('Invalid.')).toBeDefined()
    })

    it('completes a second factor after the password', async () => {
      resolvesTo(signIn.password, {
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'totp' }],
      })
      resolvesTo(signIn.mfa.verifyTOTP, { status: 'complete' })
      const onSuccess = vi.fn()
      renderForm(onSuccess)
      type('Email', 'a@b.com')
      type('Password', 'pw')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await screen.findByText(/authenticator app/i)
      type('Verification code', '123456')
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
      await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled())
      expect(signIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: '123456' })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('sends the code for a phone second factor before asking for it', async () => {
      resolvesTo(signIn.password, {
        status: 'needs_second_factor',
        supportedSecondFactors: [
          { strategy: 'phone_code', safeIdentifier: '+31 6 ••• 12' },
        ],
      })
      renderForm()
      type('Email', 'a@b.com')
      type('Password', 'pw')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await screen.findByText(/\+31 6 ••• 12/)
      expect(signIn.mfa.sendPhoneCode).toHaveBeenCalledTimes(1)
    })
  })

  describe('email code', () => {
    it('asks for an email before sending a code', () => {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect(screen.getByRole('alert').textContent).toMatch(/email address/i)
      expect(signIn.create).not.toHaveBeenCalled()
    })

    it('sends a code to the typed email and shows the code step', async () => {
      await reachCodeStep()
      expect(signIn.create).toHaveBeenCalledWith({ identifier: 'a@b.com' })
      expect(signIn.emailCode.sendCode).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/6-digit code to a@b\.com/)).toBeDefined()
    })

    it('signs in with the code and lands where password sign-in lands', async () => {
      resolvesTo(signIn.emailCode.verifyCode, { status: 'complete' })
      const onSuccess = await reachCodeStep()
      type('Code', '424242')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled())
      expect(signIn.emailCode.verifyCode).toHaveBeenCalledWith({
        code: '424242',
      })
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('continues into the second factor when the account has one', async () => {
      resolvesTo(signIn.emailCode.verifyCode, {
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'backup_code' }],
      })
      await reachCodeStep()
      type('Code', '424242')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await screen.findByLabelText('Backup code')
      expect(signIn.finalize).not.toHaveBeenCalled()
    })

    it('says so when the account has no email-code sign-in', async () => {
      resolvesTo(signIn.create, {
        supportedFirstFactors: [{ strategy: 'password' }],
      })
      renderForm()
      type('Email', 'a@b.com')
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect(await screen.findByText(/aren't available/i)).toBeDefined()
      expect(signIn.emailCode.sendCode).not.toHaveBeenCalled()
    })

    it.each([
      ['form_code_incorrect', /isn't right/i],
      ['verification_expired', /expired/i],
      ['too_many_requests', /too many attempts/i],
    ])('explains a %s failure in plain words', async (code, message) => {
      signIn.emailCode.verifyCode.mockResolvedValue({ error: clerkError(code) })
      await reachCodeStep()
      type('Code', '000000')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toMatch(message)
      expect(alert.textContent).not.toMatch(/clerk says no/)
      // Still on the code step, so the person can try again.
      expect(screen.getByLabelText('Code')).toBeDefined()
    })

    it('treats an HTTP 429 as a rate limit', async () => {
      signIn.emailCode.sendCode.mockResolvedValue({
        error: { status: 429, errors: [] },
      })
      resolvesTo(signIn.create, { supportedFirstFactors: emailCodeFactors })
      renderForm()
      type('Email', 'a@b.com')
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /too many attempts/i,
      )
    })

    it('falls back to the Clerk message for anything else', async () => {
      signIn.emailCode.verifyCode.mockResolvedValue({
        error: clerkError('something_else', 'Clerk text'),
      })
      await reachCodeStep()
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      expect(await screen.findByText('Clerk text')).toBeDefined()
    })

    it('holds "send a new code" back for a cooldown, then resends', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
      await reachCodeStep()
      const resend = () =>
        screen.getByRole('button', { name: /new code/i }) as HTMLButtonElement
      await vi.waitFor(() => expect(resend().textContent).toMatch(/30s/))
      expect(resend().disabled).toBe(true)

      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      expect(resend().textContent).toMatch(/20s/)

      await act(async () => {
        vi.advanceTimersByTime(20_000)
      })
      expect(resend().disabled).toBe(false)
      expect(resend().textContent).toBe('Send a new code')

      signIn.emailCode.sendCode.mockClear()
      await act(async () => {
        fireEvent.click(resend())
      })
      expect(signIn.emailCode.sendCode).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/new code is on its way/i)).toBeDefined()
      await vi.waitFor(() => expect(resend().disabled).toBe(true))
    })

    it('lets the person change email or fall back to a password', async () => {
      await reachCodeStep()
      fireEvent.click(
        screen.getByRole('button', { name: /change email or use a password/i }),
      )
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
        'a@b.com',
      )
      expect(screen.getByLabelText('Password')).toBeDefined()
      expect(signIn.reset).toHaveBeenCalledTimes(1)
    })
  })

  it('renders the code flow in Dutch', async () => {
    resolvesTo(signIn.create, { supportedFirstFactors: emailCodeFactors })
    signIn.emailCode.verifyCode.mockResolvedValue({
      error: clerkError('form_code_incorrect'),
    })
    renderForm(vi.fn(), 'nl')
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mail me een code' }))
    await screen.findByText(/code van 6 cijfers gestuurd naar a@b\.com/)
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/klopt niet/)
  })
})
