/**
 * The sign-in, sign-up and recovery pages and the forms behind them
 * (`src/lib/auth/`, `src/routes/sign-in.tsx` and friends).
 *
 * Clerk's own error text is English whatever the page language is, so the
 * failures a person can act on (a wrong or expired code, a rate limit) are
 * mapped to the `errors` below by code (`emailCodeErrorKey` in
 * `src/lib/auth/core.ts`); only the leftovers fall back to Clerk's words.
 */
export const auth = {
  wait: 'Please wait…',
  email: 'Email',
  password: 'Password',
  code: 'Code',
  verificationCode: 'Verification code',

  errors: {
    generic: 'Something went wrong. Try again.',
    emailRequired: 'Enter your email address first.',
    codeIncorrect: "That code isn't right. Check it and try again.",
    codeExpired:
      'That code has expired or was tried too often. Send a new one.',
    rateLimited: 'Too many attempts. Wait a minute and try again.',
    invalidVerification: 'Invalid or incomplete verification.',
    needsExtraStep:
      "This account needs a sign-in step this form can't complete.",
    noSecondFactor:
      'No supported verification method is set up for this account.',
  },

  signIn: {
    eyebrow: 'Sign in',
    title: 'Welcome back',
    subtitle: 'Use your Gather account to open your groups.',
    submit: 'Sign in',
    forgotPassword: 'Forgot password?',
    createAccount: 'Create an account',
    redirecting: {
      eyebrow: 'Signed in',
      title: 'Opening Gather',
      subtitle: 'Taking you to your groups.',
      body: 'Redirecting…',
    },
    emailCode: {
      send: 'Email me a code',
      unavailable: "Sign-in codes aren't available for this account.",
      sent: 'We sent a 6-digit code to {email}.',
      resend: 'Send a new code',
      resendIn: 'Send a new code in {seconds}s',
      resent: 'A new code is on its way.',
      back: 'Change email or use a password',
    },
    secondFactor: {
      totp: 'Enter the code from your authenticator app.',
      backupCode: 'Enter one of your backup codes.',
      sent: 'We sent a code to {contact}.',
      sentFallback: 'your verified contact',
      backupCodeLabel: 'Backup code',
      verify: 'Verify',
      back: 'Back to sign in',
    },
  },

  signUp: {
    eyebrow: 'Create account',
    title: 'Start using Gather',
    subtitle: 'Create your account and start a group to share.',
    submit: 'Create account',
    haveAccount: 'Already have an account? Sign in',
    codeSent: 'We sent a code to {email}.',
    verify: 'Verify',
  },

  forgotPassword: {
    eyebrow: 'Account recovery',
    title: 'Reset your password',
    subtitle: 'Send a recovery code and get back to your groups.',
    sendCode: 'Send code',
    newPassword: 'New password',
    submit: 'Reset password',
    failed: 'Could not reset password.',
  },

  testLogin: {
    button: '▶ Dev: log in as test user',
    needsSteps: 'Test user requires additional steps.',
  },
}
