import type { AppearancePreference } from '@gather/core/appearance'
import { en as coreEn } from '@gather/core/messages'

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
 */
export const en = {
  brand: coreEn.shell.publicFrame.brand,

  welcome: {
    tagline: coreEn.shell.publicFrame.tagline,
    title: coreEn.shell.about.title,
    subtitle: coreEn.shell.about.subtitle,
    catalogueHeading: 'Everything a group gets',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    /** The dev-login shortcut. Only rendered on a test key with both credentials present. */
    devSignIn: 'Sign in as the test user',
    devBadge: 'Test build',
  },

  modules: coreEn.modules,

  /**
   * The Baby log's words, taken whole from the shared tree rather than
   * retyped: the phone owns its look and shares its words (ADR-0017), and a
   * second English for "Diaper" is the failure that rule names.
   */
  baby: coreEn.baby,

  /**
   * Recipes, for the same reason and on the same terms as the Baby log above.
   * Some of what comes across the phone never draws — the three view modes,
   * the sharing panel — and some of it the *web* never draws, like the photo
   * row. A Module's words are one tree either way (ADR-0017).
   */
  recipes: coreEn.recipes,

  /** Shared by Recipes' nutrition panel and by the food diary when it lands. */
  nutrients: coreEn.nutrients,

  /**
   * The tasting Modules' words, taken whole from the shared tree for the same
   * reason the Baby log's are: the phone owns its look and shares its words
   * (ADR-0017), and a second English for "Semi-hard" is the failure that rule
   * names. The later web companion reads the same tree.
   */
  tastings: coreEn.tastings,

  /**
   * The signed-in shell: the five fixed tabs, the Group switcher sheet, and
   * the seat a tab keeps until its Module is built for the phone.
   *
   * Almost nothing here is newly written. A tab is the Module's own `label`,
   * Home and All are the web's `shell.nav`, the switcher speaks
   * `shell.groupSwitcher`, and Home's subtitle is the web's Home subtitle —
   * ADR-0017's rule is that the phone owns its look and shares its words, and
   * a second vocabulary for the same five destinations is the failure it names.
   */
  shell: {
    tabs: {
      home: coreEn.shell.nav.home,
      search: 'Search',
      add: 'Add',
      settings: coreEn.shell.nav.settings,
      all: coreEn.shell.nav.all,
    },

    add: {
      title: 'Add to {group}',
      workingOnly: 'Only actions that work today.',
      close: 'Close',
      back: 'Back to actions',
      save: 'Save {noun}',
      saved: 'Added: {items}',
      sheetHint:
        'Saving keeps you in {group}. The back arrow returns to the other actions.',
      kinds: {
        row: 'in the row',
        sheet: 'in the sheet',
        handoff: 'opens a form',
        compose: 'pick, then rate',
      },
      actions: {
        'cheese-tasting': {
          label: coreEn.tastings.kinds.cheese.launcher,
          module: coreEn.modules.byId.cheeses.label,
          fields: [],
          noun: coreEn.tastings.kinds.cheese.one,
        },
        'wine-tasting': {
          label: coreEn.tastings.kinds.wine.launcher,
          module: coreEn.modules.byId.wines.label,
          fields: [],
          noun: coreEn.tastings.kinds.wine.one,
        },
        'beer-tasting': {
          label: coreEn.tastings.kinds.beer.launcher,
          module: coreEn.modules.byId.beers.label,
          fields: [],
          noun: coreEn.tastings.kinds.beer.one,
        },
        'task-new': {
          label: 'Add a task',
          module: coreEn.modules.byId.tasks.label,
          fields: ['What needs doing?'],
          noun: 'task',
        },
        'recipe-import': {
          label: 'Import from a link',
          module: coreEn.modules.byId.recipes.label,
          fields: [],
          noun: 'import',
        },
        'meal-log': {
          label: 'Log a meal',
          module: coreEn.modules.byId.nutrition.label,
          fields: ['Food', 'How much?'],
          noun: 'meal',
        },
        'food-scan': {
          label: 'Scan a barcode',
          module: coreEn.modules.byId.nutrition.label,
          fields: [],
          noun: 'food',
        },
      },
      create: {
        title: 'Create',
        description:
          'This is a temporary stand-in for the full Module form. It does not save anything.',
        fields: ['Name', 'Notes', 'Tags'],
        save: 'Save',
        saved: 'Nothing was saved — this is a demo flow.',
      },
    },

    search: {
      title: 'Search',
      deferred:
        'Search is being designed around the records it will safely find.',
    },

    /**
     * Home names the current Group and is the way out of it, in one control
     * (ADR-0015). There is no Group line anywhere else in the shell.
     */
    home: {
      /** The accessible name of the Group button; `{group}` is its name. */
      switchFrom: 'Group: {group}. {action}',
      personalSubtitle: coreEn.shell.home.personalSubtitle,
      sharedSubtitle: coreEn.shell.home.sharedSubtitle,
      pins: coreEn.shell.allModules.yourPins,
      nothingPinned: 'Nothing pinned in this Group yet.',
    },

    all: coreEn.shell.allModules,

    placeholder: coreEn.shell.placeholder,

    switcher: {
      action: coreEn.shell.groupSwitcher.label,
      title: coreEn.shell.groupSwitcher.pick,
      personal: coreEn.shell.groupSwitcher.personalPill,
      shared: coreEn.shell.groupSwitcher.shared,
      /** Marks the row you are already in, for a reader who cannot see the tick. */
      current: 'Current group',
    },

    /** The Groups screen: the households you are in, and the two ways to get another. */
    groups: {
      ...coreEn.shell.groups,
      /**
       * The one string here that is *not* the web's. The web's intro says
       * "Open one to change its name, share its invite code, or leave it" —
       * three things the phone cannot do and one, switching, that it does
       * somewhere else entirely (ADR-0015: on Home). Shared words stop being
       * shared the moment they describe a surface the other client does not
       * have.
       */
      intro:
        'The households you are in. Home is where you switch between them; start another one or join somebody else’s below.',
    },

    /** The way into the utility surfaces that sit above the tabs. */
    openSettings: coreEn.shell.nav.settings,
  },

  /**
   * Settings, which on the phone is the fourth tab: a grouped list of every
   * preference that is about *you* rather than about a Group, plus the way on
   * to Account and Groups. The profile is not a destination of its own — it is
   * the card at the top of that list.
   *
   * Language is the web's own words: the sentence explaining that Gather's
   * chrome is translated and your content is not is the same promise on both
   * clients, and ADR-0017 says a second vocabulary for it would be the failure.
   *
   * Appearance is not, and cannot be. The web's control comes from
   * `@appelent/auth`, which is React-DOM only, hardcodes its copy in English,
   * and calls the third option "Auto"; none of that crosses. The phone writes
   * its own three words and uses the platform's — see
   * `@gather/core/appearance` for why the stored token is `system`.
   */
  settings: {
    title: coreEn.settings.title,

    language: coreEn.settings.language,

    appearance: {
      title: 'Appearance',
      description:
        'How Gather looks on this phone. It is remembered here rather than on your account, so it is the same in every group and does not follow you to another device.',
      /**
       * Keyed by the preference union, so adding a fourth appearance without
       * naming it is a type error rather than a blank button.
       */
      modes: {
        light: 'Light',
        system: 'System',
        dark: 'Dark',
      } satisfies Record<AppearancePreference, string>,
      /** The accessible name of a mode button; `{mode}` is one of the three above. */
      choose: 'Appearance: {mode}',
    },

    /** The rows out of Settings, each named for where it lands. */
    account: coreEn.shell.routes.account.title,
    groups: coreEn.shell.groups.title,

    /**
     * The two groups the list is drawn in. "On this phone" is a claim rather
     * than a heading: those are the settings that are written here and do not
     * follow you to another device.
     */
    sections: {
      account: coreEn.shell.routes.account.title,
      phone: 'On this phone',
      modules: 'Modules',
    },

    /**
     * The field above the list. It is the way through for somebody who knows
     * the word and not the group, so its own words have to be the plainest
     * ones available.
     */
    search: {
      placeholder: 'Search settings',
      /** `{query}` is what they typed, quoted back at them. */
      empty: 'Nothing called “{query}”.',
    },

    /** The card at the top of the list; `{name}` is a name or an email. */
    identity: 'Account: {name}',
  },

  /**
   * Who you are, and the way out.
   *
   * Deliberately read-only. Clerk can change a name or a password from the
   * phone, but a native profile editor is not this shell's job (#159 keeps v1
   * to the shell), and an editable-looking field that does nothing would be
   * worse than saying where it can be done.
   */
  account: {
    title: coreEn.shell.routes.account.title,
    managedOnWeb:
      'Your name, email address and password are managed in Gather on the web.',
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
    save: 'Save',
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    done: 'Done',
    completed: 'Completed ({count})',
    showCompleted: 'Show completed tasks',
    hideCompleted: 'Hide completed tasks',
    taskUpdateFailed: 'That task could not be updated. Please try again.',
    reorder: 'Reorder',
    hide: 'Hide',
    showAll: 'Show all',
    loading: 'Loading',
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
      subtitle:
        'Tell us the address you signed up with and we will send a code.',
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
   * The in-app availability states. Local preferences remain outside this
   * boundary so the gate and its recovery action can always render.
   */
  gate: {
    title: 'Gather is unavailable',
    offline: 'Still trying to reach Gather. Check your connection.',
    connectionLost: 'Connection lost. Gather will keep trying to reconnect.',
    retry: 'Try again',
  },

  /**
   * The ambient Group (ADR-0015) while it is being established, and the one
   * signed-in state where there is none to establish.
   *
   * `noneBody` used to send people to the web, because the phone had no way to
   * make a Group. It has one from #164, and the same two forms the Groups
   * screen uses are rendered directly under this — a dead end that names
   * another client is not an answer when the answer is on screen.
   */
  group: {
    loading: coreEn.common.errors.loading,
    noneTitle: 'You are not in a group yet',
    noneBody:
      'Gather makes you a personal group the first time you sign in. If this stays here, start one below or join somebody else’s with their invite code.',
  },

  /**
   * Who you are, and the way out. Both live on Account, above the tabs — they
   * sat on Home until #164 gave the shell somewhere for them.
   */
  signedIn: {
    /** `{email}` is the signed-in account. */
    as: 'Signed in as {email}',
    signOut: 'Sign out',
  },

  errors: {
    generic: 'Something went wrong. Try again.',
    network: 'No connection. Check your network and try again.',
    identifierNotFound: 'We could not find an account with that email.',
    passwordIncorrect: 'That password is not right.',
    passwordDoesNotMeetRequirements:
      'That password does not meet the requirements.',
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
