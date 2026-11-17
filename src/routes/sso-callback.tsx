import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { createFileRoute } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { useAuthConfig } from '../lib/auth'
import { useI18n } from '../lib/i18n'

/**
 * Where Apple and Microsoft send the browser back (`AuthConfig.paths
 * .ssoCallback`). Clerk finishes the sign-in here, or turns an unknown account
 * into a sign-up, then moves on to `afterAuth`. Client-only: the callback reads
 * the URL Clerk returned to.
 *
 * When the attempt needs more (a second factor, a sign-up field, an email
 * check), Clerk would send the browser to its own components' hash routes
 * (`/sign-in#/factor-two`), which gather's forms do not read. Every
 * continuation therefore goes to the plain sign-in or sign-up page, and those
 * forms pick up the attempt Clerk holds (`SignInForm` / `SignUpForm`).
 */
export const Route = createFileRoute('/sso-callback')({
  ssr: false,
  component: SsoCallbackPage,
})

export function SsoCallbackPage() {
  const { paths } = useAuthConfig()
  const { locale, messages } = useI18n()
  const text = messages.auth.ssoCallback
  return (
    <PublicPageFrame
      eyebrow={text.eyebrow}
      title={text.title}
      subtitle={text.subtitle}
    >
      <AuthenticateWithRedirectCallback
        signInUrl={paths.signIn}
        signUpUrl={paths.signUp}
        signInFallbackRedirectUrl={paths.afterAuth}
        signUpFallbackRedirectUrl={paths.afterAuth}
        firstFactorUrl={paths.signIn}
        secondFactorUrl={paths.signIn}
        resetPasswordUrl={paths.signIn}
        continueSignUpUrl={paths.signUp}
        verifyEmailAddressUrl={paths.signUp}
        verifyPhoneNumberUrl={paths.signUp}
      />
      {/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
      <div id="clerk-captcha" data-cl-language={locale} />
    </PublicPageFrame>
  )
}
