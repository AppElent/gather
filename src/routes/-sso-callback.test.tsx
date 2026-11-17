import { expect, test, vi } from 'vitest'
import { DEFAULT_AUTH_CONFIG } from '../lib/auth/AuthConfigProvider'
import { renderWithI18n } from '../lib/i18n/testing'
import { SsoCallbackPage } from './sso-callback'

const callback = vi.hoisted(() => ({ props: {} as Record<string, unknown> }))

vi.mock('@clerk/react', () => ({
  AuthenticateWithRedirectCallback: (props: Record<string, unknown>) => {
    callback.props = props
    return null
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))

test('sends every unfinished attempt to the plain forms, never to Clerk hash routes', () => {
  renderWithI18n(<SsoCallbackPage />)
  const { signIn, signUp, afterAuth } = DEFAULT_AUTH_CONFIG.paths
  expect(callback.props).toEqual({
    signInUrl: signIn,
    signUpUrl: signUp,
    signInFallbackRedirectUrl: afterAuth,
    signUpFallbackRedirectUrl: afterAuth,
    firstFactorUrl: signIn,
    secondFactorUrl: signIn,
    resetPasswordUrl: signIn,
    continueSignUpUrl: signUp,
    verifyEmailAddressUrl: signUp,
    verifyPhoneNumberUrl: signUp,
  })
  for (const url of Object.values(callback.props)) {
    expect(String(url)).not.toContain('#')
  }
})
