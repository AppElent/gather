import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const prepareFirstFactor = vi.fn()
const attemptFirstFactor = vi.fn()
const prepareSecondFactor = vi.fn()
const attemptSecondFactor = vi.fn()
const setActive = vi.fn()
let isLoaded = true
let supportedFirstFactors: unknown[] = [
  { strategy: 'email_code', emailAddressId: 'idn_1' },
]
vi.mock('@clerk/clerk-react', () => ({
  useSignIn: () => ({
    isLoaded,
    signIn: {
      create,
      prepareFirstFactor,
      attemptFirstFactor,
      prepareSecondFactor,
      attemptSecondFactor,
      get supportedFirstFactors() {
        return supportedFirstFactors
      },
    },
    setActive,
  }),
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
  create.mockResolvedValue({ supportedFirstFactors })
  prepareFirstFactor.mockResolvedValue({})
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
    for (const fn of [
      create,
      prepareFirstFactor,
      attemptFirstFactor,
      prepareSecondFactor,
      attemptSecondFactor,
      setActive,
    ]) {
      fn.mockReset()
    }
    isLoaded = true
    supportedFirstFactors = [
      { strategy: 'email_code', emailAddressId: 'idn_1' },
    ]
  })

  describe('password', () => {
    it('does not submit while Clerk is not loaded', () => {
      isLoaded = false
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      expect(create).not.toHaveBeenCalled()
    })

    it('submits credentials and activates the session', async () => {
      create.mockResolvedValue({ status: 'complete', createdSessionId: 's1' })
      const onSuccess = vi.fn()
      renderForm(onSuccess)
      type('Email', 'a@b.com')
      type('Password', 'pw')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await vi.waitFor(() =>
        expect(setActive).toHaveBeenCalledWith({ session: 's1' }),
      )
      expect(create).toHaveBeenCalledWith({
        identifier: 'a@b.com',
        password: 'pw',
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('shows a readable error on failure', async () => {
      create.mockRejectedValue({ errors: [{ message: 'Invalid.' }] })
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      expect(await screen.findByText('Invalid.')).toBeDefined()
    })

    it('completes a second factor after the password', async () => {
      create.mockResolvedValue({
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'totp' }],
      })
      attemptSecondFactor.mockResolvedValue({
        status: 'complete',
        createdSessionId: 's2',
      })
      const onSuccess = vi.fn()
      renderForm(onSuccess)
      type('Email', 'a@b.com')
      type('Password', 'pw')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await screen.findByText(/authenticator app/i)
      type('Verification code', '123456')
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
      await vi.waitFor(() =>
        expect(setActive).toHaveBeenCalledWith({ session: 's2' }),
      )
      expect(attemptSecondFactor).toHaveBeenCalledWith({
        strategy: 'totp',
        code: '123456',
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  describe('email code', () => {
    it('asks for an email before sending a code', () => {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect(screen.getByRole('alert').textContent).toMatch(/email address/i)
      expect(create).not.toHaveBeenCalled()
    })

    it('sends a code to the typed email and shows the code step', async () => {
      await reachCodeStep()
      expect(create).toHaveBeenCalledWith({ identifier: 'a@b.com' })
      expect(prepareFirstFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
        emailAddressId: 'idn_1',
      })
      expect(screen.getByText(/6-digit code to a@b\.com/)).toBeDefined()
    })

    it('signs in with the code and lands where password sign-in lands', async () => {
      attemptFirstFactor.mockResolvedValue({
        status: 'complete',
        createdSessionId: 's3',
      })
      const onSuccess = await reachCodeStep()
      type('Code', '424242')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await vi.waitFor(() =>
        expect(setActive).toHaveBeenCalledWith({ session: 's3' }),
      )
      expect(attemptFirstFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
        code: '424242',
      })
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('continues into the second factor when the account has one', async () => {
      attemptFirstFactor.mockResolvedValue({
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'backup_code' }],
      })
      await reachCodeStep()
      type('Code', '424242')
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await screen.findByLabelText('Backup code')
      expect(setActive).not.toHaveBeenCalled()
    })

    it('says so when the account has no email-code sign-in', async () => {
      create.mockResolvedValue({
        supportedFirstFactors: [{ strategy: 'password' }],
      })
      renderForm()
      type('Email', 'a@b.com')
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect(await screen.findByText(/aren't available/i)).toBeDefined()
      expect(prepareFirstFactor).not.toHaveBeenCalled()
    })

    it.each([
      ['form_code_incorrect', /isn't right/i],
      ['verification_expired', /expired/i],
      ['too_many_requests', /too many attempts/i],
    ])('explains a %s failure in plain words', async (code, message) => {
      attemptFirstFactor.mockRejectedValue(clerkError(code))
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
      prepareFirstFactor.mockRejectedValue({ status: 429, errors: [] })
      create.mockResolvedValue({ supportedFirstFactors })
      renderForm()
      type('Email', 'a@b.com')
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }))
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /too many attempts/i,
      )
    })

    it('falls back to the Clerk message for anything else', async () => {
      attemptFirstFactor.mockRejectedValue(
        clerkError('something_else', 'Clerk text'),
      )
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

      prepareFirstFactor.mockClear()
      await act(async () => {
        fireEvent.click(resend())
      })
      expect(prepareFirstFactor).toHaveBeenCalledTimes(1)
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
    })
  })

  it('renders the code flow in Dutch', async () => {
    create.mockResolvedValue({ supportedFirstFactors })
    prepareFirstFactor.mockResolvedValue({})
    attemptFirstFactor.mockRejectedValue(clerkError('form_code_incorrect'))
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
