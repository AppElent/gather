/**
 * English is the source language (ADR-0011). Every string a signed-out person
 * can see lives here first, and `nl.ts` `satisfies` this object — so a key that
 * exists in one locale and not the other is a type error, not a blank label.
 *
 * Two kinds of string are mixed together on purpose, and they are not equally
 * ours:
 *
 * - **The phone's own words** — everything under `signIn`, `signUp`, `verify`,
 *   `reset`, `fields`, `actions`, `errors`, `gate`. The web has no counterpart:
 *   its forms come from `@appelent/auth`, which is React-DOM only and never
 *   crosses. These are written here and belong here.
 * - **Shared words** — `brand`, `welcome.tagline/title/subtitle`, and the whole
 *   of `modules`. These are transcribed from the web's `src/lib/i18n/messages/`
 *   so the two clients make the same promise in the same words.
 *   TODO(#143): move to `packages/core` when it exists, and delete these.
 */
export const en = {
  brand: 'Gather',

  welcome: {
    /** Web: shell.publicFrame.tagline */
    tagline: 'Household plans, shared',
    /** Web: shell.about.title */
    title: 'One shared group for everyday coordination',
    /** Web: shell.about.subtitle */
    subtitle:
      'Gather keeps shared recipes, plans, lists, tasks, notes, and tasting logs in one place, for the people who share a household.',
    catalogueHeading: 'Everything a group gets',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    /** The dev-login shortcut. Only rendered on a test key with both credentials present. */
    devSignIn: 'Sign in as the test user',
    devBadge: 'Test build',
  },

  /** Web: modules.byId[*].label and modules.groups. */
  modules: {
    byId: {
      recipes: 'Recipes',
      nutrition: 'Nutrition',
      'meal-planner': 'Meal planner',
      groceries: 'Groceries',
      pantry: 'Pantry',
      finances: 'Finances',
      bills: 'Bills & subscriptions',
      tasks: 'Tasks',
      'baby-log': 'Baby log',
      calendar: 'Calendar',
      notes: 'Notes',
      cheeses: 'Cheeses',
      wines: 'Wines',
    },
    groups: {
      kitchen: 'Kitchen',
      money: 'Money',
      home: 'Home & life',
      tasting: 'Tasting',
    },
  },

  /**
   * Social sign-in, announced before it exists.
   *
   * None of these are enabled on the Clerk instance (`socialProviders: []`, see
   * #139), so the rows are inert and say so. `soon` is the web's own word for
   * this — `shell.marks.soon` — because a staged Module and a staged sign-in
   * method should not be marked in two different vocabularies.
   */
  social: {
    heading: 'Or continue with',
    soon: 'Soon',
    apple: 'Apple',
    microsoft: 'Microsoft',
    google: 'Google',
    /** The accessible name; `{provider}` is one of the three above. */
    unavailable: 'Continue with {provider} — coming soon',
  },

  fields: {
    email: 'Email',
    password: 'Password',
    newPassword: 'New password',
    code: 'Code',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },

  actions: {
    continue: 'Continue',
    back: 'Back',
    resend: 'Send it again',
  },

  signIn: {
    title: 'Sign in',
    heading: 'Welcome back',
    submit: 'Sign in',
    forgot: 'Forgotten your password?',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
  },

  signUp: {
    title: 'Create an account',
    heading: 'Create your account',
    subtitle: 'You will get a code by email to confirm the address.',
    submit: 'Create account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
  },

  verify: {
    title: 'Confirm your email',
    heading: 'Check your email',
    /** `{email}` is the address the code went to. */
    subtitle: 'We sent a six-digit code to {email}.',
    submit: 'Confirm',
    resent: 'Sent — check your email again.',
  },

  reset: {
    request: {
      title: 'Reset your password',
      heading: 'Reset your password',
      subtitle: 'Tell us the address you signed up with and we will send a code.',
      submit: 'Send the code',
    },
    code: {
      title: 'Enter the code',
      heading: 'Check your email',
      /** `{email}` is the address the code went to. */
      subtitle: 'We sent a six-digit code to {email}.',
      submit: 'Continue',
    },
    password: {
      title: 'Choose a password',
      heading: 'Choose a new password',
      subtitle: 'Pick something you have not used here before.',
      submit: 'Save and sign in',
    },
  },

  /**
   * The in-app gate. Only ever seen when Clerk takes longer than the splash hold
   * allows — the splash is the real answer to the cold-start question, and this
   * is what is behind it when the timeout wins.
   */
  gate: {
    offline: 'Still trying to reach Gather. Check your connection.',
  },

  /**
   * The placeholder behind the door. Signing in has to land somewhere to prove
   * the guard and the cold start, and the real shell is #146's, unmerged.
   */
  signedIn: {
    heading: 'You are signed in',
    /** `{email}` is the signed-in account. */
    as: 'Signed in as {email}',
    note: 'The Group shell lands here (#146). This prototype stops at the door.',
    signOut: 'Sign out',
  },

  errors: {
    generic: 'Something went wrong. Try again.',
    network: 'No connection. Check your network and try again.',
    identifierNotFound: 'We could not find an account with that email.',
    passwordIncorrect: 'That password is not right.',
    identifierExists: 'There is already an account with that email.',
    emailInvalid: 'That does not look like an email address.',
    passwordTooShort: 'Passwords need at least eight characters.',
    passwordPwned:
      'That password has turned up in a data breach. Please pick another.',
    codeIncorrect: 'That code is not right.',
    codeExpired: 'That code has expired. Ask for a new one.',
    required: 'This cannot be empty.',
    tooManyRequests: 'Too many attempts. Wait a moment and try again.',
  },
}
