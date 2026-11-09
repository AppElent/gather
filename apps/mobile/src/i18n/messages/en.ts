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
 *   its forms live in `src/lib/auth`, which is React-DOM only and never
 *   crosses. These are written here and belong here.
 * - **Shared words** — every value read from `coreEn` (`@gather/core/messages`),
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
   * Generic words (Save, Cancel, Delete, Back…) are the shared tree's `common`,
   * never a second copy here.
   */
  common: coreEn.common,

  /**
   * The Baby log's words, taken whole from the shared tree rather than
   * retyped: the phone owns its look and shares its words (ADR-0017), and a
   * second English for "Diaper" is the failure that rule names.
   */
  baby: coreEn.baby,
  calendar: coreEn.calendar,

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
   * The Money Modules' words, taken whole from the shared tree for the
   * same reason the Baby log's are: the phone owns its look and shares its
   * words (ADR-0017), and a second English for "Loan part" is the failure
   * that rule names.
   */
  finances: coreEn.finances,

  search: {
    title: 'Search',
    placeholder: 'Search this Group',
    recent: 'Recent',
    /** The Recent section's own control, beside the expand chevron. */
    clearRecent: 'Clear',
    empty: 'Recently opened items appear here.',
    noResults: 'Nothing found.',
    failed: 'Search is unavailable right now.',
    clear: 'Clear search',
    types: {
      recipe: 'Recipe',
      task: 'Task',
      note: 'Note',
      tasting: 'Tasting',
      calendarEvent: 'Event',
    },
    kinds: { cheese: 'Cheese', wine: 'Wine', beer: 'Beer' },
  },

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
      back: 'Back to actions',
      saved: 'Added: {items}',
      kinds: {
        row: 'in the row',
        handoff: 'opens a form',
        compose: 'pick, then rate',
      },
      actions: {
        'cheese-tasting': {
          label: coreEn.tastings.kinds.cheese.launcher,
          module: coreEn.modules.byId.cheeses.label,
        },
        'wine-tasting': {
          label: coreEn.tastings.kinds.wine.launcher,
          module: coreEn.modules.byId.wines.label,
        },
        'beer-tasting': {
          label: coreEn.tastings.kinds.beer.launcher,
          module: coreEn.modules.byId.beers.label,
        },
        'task-new': {
          label: 'Add a task',
          module: coreEn.modules.byId.tasks.label,
        },
        'recipe-import': {
          label: 'Import from a link',
          module: coreEn.modules.byId.recipes.label,
        },
      },
    },

    /**
     * Home names the current Group and is the way out of it, in one control
     * (ADR-0015). There is no Group line anywhere else in the shell.
     */
    home: {
      /** The accessible name of the Group button; `{group}` is its name. */
      switchFrom: 'Group: {group}. {action}',
      intro: 'Welcome to Gather. Find every module for this group in All.',
    },

    /**
     * The All screen. The shared vocabulary comes straight from the web -
     * `pin`, `unpin`, `pinModule`, `unpinModule` are one word on both clients
     * (ADR-0017) even though the phone keeps its own list (ADR-0033).
     *
     * Everything spread on top is chrome the web has no equivalent of: the
     * phone collapses its sections, hides Modules, arranges them in a mode,
     * and draws them as rows or as tiles. The web's `moveUp` / `moveDown`
     * survive in the alias unused - they name two buttons that only exist
     * where there is no drag.
     */
    all: {
      ...coreEn.shell.allModules,
      /** The shortcut section at the top. The word is Pin, never Favourite. */
      /** The compact list in Edit mode that reorders the sections themselves. */
      categories: 'Categories',
      pinned: 'Pinned',
      /** The section at the bottom holding what this phone has been told to put away. */
      hidden: 'Hidden',
      hiddenCount: 'Hidden ({count})',
      hide: 'Hide',
      show: 'Show',
      hideModule: 'Hide {module}',
      showModule: 'Show {module}',
      /** Enters and leaves the arranging mode. */
      edit: 'Edit modules',
      done: 'Done',
      /** The nav-bar menu, and the two things it can draw. */
      options: 'View options',
      view: 'View',
      viewList: 'List',
      viewGrid: 'Grid',
      /** Names a section for a reader who cannot see the chevron. */
      collapse: 'Collapse {section}',
      expand: 'Expand {section}',
      /** Sits above the list in Edit mode and says what the grips are for. */
      reorderHint:
        'Drag a handle to rearrange. A module stays in its own category.',
      dragModule: 'Reorder {module}',
      dragSection: 'Reorder {section}',
    },

    placeholder: coreEn.shell.placeholder,

    switcher: {
      action: coreEn.shell.groupSwitcher.label,
      title: coreEn.shell.groupSwitcher.pick,
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
      /**
       * Deleting the Current Group, in the web's words (`settings.group`). The
       * server allows it only to an admin who is its last Member.
       */
      delete: {
        button: coreEn.settings.group.deleteButton,
        title: coreEn.settings.group.deleteTitle,
        body: coreEn.settings.group.deleteBody,
        confirm: coreEn.settings.group.deleteConfirm,
        failed: coreEn.settings.group.deleteFailed,
        othersFirst: coreEn.settings.group.deleteOthersFirst,
      },
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
   * Appearance is not, and cannot be. The web's control is
   * `src/lib/auth`'s `AppearanceSettings`, which is React-DOM only and calls
   * the third option "Auto"; none of that crosses. The phone writes
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
      about: coreEn.shell.about.eyebrow,
    },

    /** Opens the web's statement in a browser; the words are the web's own. */
    privacy: coreEn.privacy.title,

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
   * Who you are, what can be changed about it, and the two ways out.
   *
   * An app that signs people up has to let them leave from the same place
   * (App Store guideline 5.1.1(v)).
   *
   * The hub is a list, like Settings itself, and each thing you can change is
   * its own screen. Only `email` is read-only, and it says so rather than
   * offering a field that does nothing.
   */
  account: {
    title: coreEn.shell.routes.account.title,
    /** The rows on the hub. */
    name: 'Name',
    password: 'Password',
    email: 'Email',
    devices: 'Devices',

    /** The row and the screen that writes the person's data to a file. */
    dataExport: coreEn.settings.dataExport,

    /** Changing the name Clerk holds. Both halves, because Clerk stores both. */
    editName: {
      title: 'Name',
      description: 'What other members of your Groups see.',
      first: 'First name',
      last: 'Last name',
    },

    changePassword: {
      title: 'Password',
      description:
        'Changing it signs you out everywhere else, on every other phone and browser.',
      current: 'Current password',
      next: 'New password',
      submit: 'Change password',
      noPassword:
        'You sign in without a password, so there is none to change here.',
    },

    /**
     * Read-only on purpose: adding an address is a verification flow of its
     * own, and a field that looks editable and is not would be worse than a
     * sentence saying where it can be done.
     */
    emails: {
      title: 'Email',
      description: 'The addresses you can sign in with.',
      primary: 'Primary',
      unverified: 'Not verified',
      addOnWeb: 'Adding or removing an address is done in Gather on the web.',
    },

    /**
     * Clerk's sessions, named by what they were last seen on. The one you are
     * holding cannot be revoked from itself — that is what Sign out is.
     */
    sessions: {
      title: 'Devices',
      description: 'Where you are signed in.',
      thisDevice: 'This device',
      lastActive: 'Last active {when}',
      unknownDevice: 'Unknown device',
      signOutOf: 'Sign out',
      revokeTitle: 'Sign out of {device}?',
      revokeBody: 'That device has to sign in again.',
    },

    /** Changing the picture. It is Clerk's, not the household's storage. */
    picture: {
      change: 'Change photo',
      take: 'Take a photo',
      choose: 'Choose a photo',
      denied: 'Gather needs permission to use the camera or your photos.',
      failed: 'That photo could not be saved.',
    },

    /**
     * The end of the account, and the one screen in the app that has to say
     * what it is about to destroy *before* the confirmation rather than inside
     * it. An alert is the wrong place to read a list of households.
     */
    deleteAccount: {
      title: 'Delete account',
      lead: 'This cannot be undone.',
      goesHeading: 'Deleted with your account',
      goesBody:
        'You are the only member of these Groups, so they go, and everything in them goes with them.',
      keptHeading: 'Left, not deleted',
      keptBody:
        'These Groups have other members. You stop seeing them, and anything you added stays with the household.',
      noGroups: 'You are not in any Groups.',
      submit: 'Delete my account',
      confirmTitle: 'Delete {email}?',
      confirmBody:
        'Your account and everything only you could see is deleted for good.',
      /**
       * The half-way failure, which is real: Convex is purged before Clerk,
       * because the purge needs a signed-in caller and there is none once the
       * Clerk user is gone (ADR-0032). Saying "nothing has been removed" here
       * would be a lie.
       */
      partlyFailed:
        'Your data was deleted, but the account itself could not be. Try again, or contact support if it keeps failing.',
      /** On screen in place of the app while Clerk deletes the login. */
      underway: 'Deleting your account…',
      /** Clerk refuses self-deletion unless the instance allows it. */
      unavailable:
        'This account cannot be deleted from the app. Please contact support.',
    },

    /**
     * Shown on every control that would change the shared test account. It is
     * signed into by every preview and every CI run, so one rename breaks them
     * all — see `auth/config.ts`.
     */
    testAccount: 'This is the shared test account, so it cannot be changed.',
  },

  kitchen: {
    name: 'Name',
    quantity: 'Quantity (optional)',
    prepMinutes: 'Preparation time in minutes',
    nothingPlanned: 'Nothing planned',
    noPantry: 'Nothing in the pantry yet.',
    noGroceryList: 'Choose a task list for groceries.',
    quick: 'Quick under {minutes} minutes',
    quickShort: '≤ {minutes} min',
    timeLimit: 'Time limit',
    noTimeLimit: 'No time limit',
    searchDinners: 'Search meals and recipes',
    minutes: '{minutes} min',
    noMatches: 'Nothing matches.',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    randomizeWeek: 'Randomize unplanned week',
    mealLibrary: 'Quick meals',
    chooseDinner: 'Choose dinner',
    changeList: 'Use another list',
    addGroceryItem: 'Add an item…',
    clearDinner: 'Clear dinner',
    deleteTitle: 'Delete “{title}”?',
    deleteBody: 'This cannot be undone.',
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
    resend: 'Send it again',
    done: 'Done',
    completed: 'Completed ({count})',
    showCompleted: 'Show completed tasks',
    hideCompleted: 'Hide completed tasks',
    taskUpdateFailed: 'That task could not be updated. Please try again.',
    reorder: 'Reorder',
    hide: 'Hide',
    showAll: 'Show all',
    showLess: 'Show less',
    loading: 'Loading',
  },

  signIn: {
    heading: 'Welcome back',
    submit: 'Sign in',
    forgot: 'Forgotten your password?',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    /**
     * Passwordless sign-in, in the web's words (`auth.signIn.emailCode`) except
     * for the second-factor heading, which the web draws as a form title.
     */
    emailCode: {
      send: coreEn.auth.signIn.emailCode.send,
      /** `{email}` is the address the code went to. */
      sent: coreEn.auth.signIn.emailCode.sent,
      resend: coreEn.auth.signIn.emailCode.resend,
      /** `{seconds}` counts down until a new code may be asked for. */
      resendIn: coreEn.auth.signIn.emailCode.resendIn,
      resent: coreEn.auth.signIn.emailCode.resent,
      back: coreEn.auth.signIn.emailCode.back,
      secondFactor: {
        heading: 'One more step',
        totp: coreEn.auth.signIn.secondFactor.totp,
        backupCode: coreEn.auth.signIn.secondFactor.backupCode,
        /** `{contact}` is where Clerk sent the code. */
        sent: coreEn.auth.signIn.secondFactor.sent,
        sentFallback: coreEn.auth.signIn.secondFactor.sentFallback,
        backupCodeLabel: coreEn.auth.signIn.secondFactor.backupCodeLabel,
        verify: coreEn.auth.signIn.secondFactor.verify,
        back: coreEn.auth.signIn.secondFactor.back,
      },
    },
  },

  signUp: {
    heading: 'Create your account',
    subtitle: 'You will get a code by email to confirm the address.',
    submit: 'Create account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
  },

  verify: {
    heading: 'Check your email',
    /** `{email}` is the address the code went to. */
    subtitle: 'We sent a six-digit code to {email}.',
    resent: 'Sent — check your email again.',
  },

  reset: {
    request: {
      heading: 'Reset your password',
      subtitle:
        'Tell us the address you signed up with and we will send a code.',
      submit: 'Send the code',
    },
    code: {
      heading: 'Check your email',
      /** `{email}` is the address the code went to. */
      subtitle: 'We sent a six-digit code to {email}.',
      submit: 'Continue',
    },
    password: {
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
   * The same two forms the Groups screen uses are rendered directly under
   * `noneBody`, so it does not send people to the web: a dead end that names
   * another client is not an answer when the answer is on screen.
   */
  group: {
    loading: coreEn.common.errors.loading,
    noneTitle: 'You are not in a group yet',
    noneBody:
      'Start a group below or join somebody else’s with their invite code.',
  },

  /**
   * The signed-in tree could not confirm who is signed in: `users.me` failed
   * (`SessionIdentityBoundary`). The actions reuse `common.actions.retry` and
   * `signedIn.signOut`.
   */
  session: {
    title: 'We could not confirm your account',
    body: 'Gather could not check who is signed in. Try again, or sign out and back in.',
  },

  /**
   * Who you are, and the way out. Both live on Account, above the tabs — they
   * sat on Home until #164 gave the shell somewhere for them.
   */
  signedIn: {
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
    codeExpired: coreEn.auth.errors.codeExpired,
    emailCodeUnavailable: coreEn.auth.signIn.emailCode.unavailable,
    needsExtraStep: coreEn.auth.errors.needsExtraStep,
    noSecondFactor: coreEn.auth.errors.noSecondFactor,
    required: 'This cannot be empty.',
    tooManyRequests: 'Too many attempts. Wait a moment and try again.',
  },

  /**
   * The share sheet's chooser (ADR-0028).
   *
   * A Drop is what another app hands to Gather — a link, some text, a photo —
   * before it is anything in Gather. It has no Group and no Module until a
   * person names one, and every word below is part of the asking.
   *
   * The destination names are written from the reader's side rather than the
   * app's: "Save as a recipe", not "Recipes". The Module is named underneath,
   * where it belongs to somebody deciding which of two notes-shaped things this
   * is.
   */
  drop: {
    title: 'Where does this go?',
    /** The Group the Drop will be saved into, named before anything is written. */
    savingTo: 'Saving to {group}',
    changeGroup: 'Change',
    /** The chooser's own name for what arrived, above the destinations. */
    kinds: {
      url: 'Link',
      text: 'Text',
      image: 'Photo',
    },
    /** Confirm, for a destination that still has to ask which one. */
    continue: 'Continue',
    cancel: 'Not now',
    targets: {
      'recipe-import': {
        label: 'Import as a recipe',
        detail: 'Gather reads the page and shows you what it found',
      },
      'recipe-new-photo': {
        label: 'Start a recipe with this photo',
        detail: 'A new recipe, with the picture already on it',
      },
      'recipe-photo': {
        label: 'Put the photo on a recipe',
        detail: 'Choose which recipe',
      },
      'note-new': { label: 'Keep as a note', detail: 'A new note' },
      'note-append': {
        label: 'Add to a note',
        detail: 'Choose which note',
      },
      'task-new': { label: 'Make it a task', detail: 'Choose which list' },
      'grocery-line': {
        label: 'Add to the groceries',
        detail: 'Straight onto this household’s grocery list',
      },
      'baby-memory': {
        label: 'Keep as a memory',
        detail: 'In the baby log',
      },
      'cheese-photo': {
        label: 'Put the photo on a cheese',
        detail: 'Choose which cheese',
      },
      'wine-photo': {
        label: 'Put the photo on a wine',
        detail: 'Choose which wine',
      },
      'beer-photo': {
        label: 'Put the photo on a beer',
        detail: 'Choose which beer',
      },
    },
    /** Stage two: which record the Drop joins. */
    pick: {
      note: 'Which note?',
      'task-list': 'Which list?',
      recipe: 'Which recipe?',
      'tasting-subject': 'Which one?',
      search: 'Search',
      /**
       * An empty Module is still offered (ADR-0022), so stage two has to be
       * able to say there is nothing here yet without it reading as a refusal.
       */
      empty: 'Nothing here yet.',
      noMatches: 'Nothing called “{query}”.',
      /** A list Gather may read but not write to (ADR-0021). */
      /** A stale address, or a Drop that was answered somewhere else. */
      gone: 'That share is no longer waiting.',
      readOnly: 'Read-only here',
    },
    /**
     * Replacing a photo is permanent, so it asks first and names the item
     * (`apps/mobile/DESIGN_SYSTEM.md`).
     */
    replaceTitle: 'Replace the photo on “{name}”?',
    replaceBody: 'The picture that is there now is deleted.',
    replace: 'Replace',
    /**
     * Something the household has not set up yet. Said on the chooser, with the
     * Drop still pending, so nothing shared is lost by finding out late.
     */
    problems: {
      'no-child': 'Add a child to the baby log first, and this can go there.',
      'no-grocery-list':
        'This household has not chosen a grocery list yet. Pick one in Groceries first.',
    },
    /** An uncaused failure — the only kind of message the vocabulary allows. */
    failed: 'That could not be saved. Try again, or pick somewhere else.',
  },

  /**
   * The Tasks Module's own words: the phone's, not `coreEn.tasks`. The web's
   * tree for the same Module is a different shape, and merging the two is
   * ADR-0017 work; until then a second `tasks` key here is a duplicate-key
   * type error, so the two cannot be confused silently.
   */
  tasks: {
    title: 'Tasks',

    /** The Add tab's "Add a task": a title, a list, and a save. */
    quickAdd: {
      /** Above the lists it can go on. Only lists Gather can write to. */
      list: 'On the list',
      save: 'Add task',
      noList: 'This group has no list Gather can add a task to yet.',
      failed: 'That task could not be added. Try again.',
    },
    today: 'Today',
    todayEmpty: 'Nothing due today.',
    lists: 'Lists',
    /** The count on the right of a list's row. */
    open: '{count} open',
    openOne: '1 open',
    allDone: 'All done',
    /** The badge on a list Gather did not create. */
    linked: 'Linked',
    /** Which list a task on the Today strip came from. */
    inList: 'in {list}',
    /** A linked list's count, when its provider did not answer. */
    notLoaded: 'Not loaded',

    list: {
      addTask: 'Add a task…',
      empty: 'Nothing on this list yet.',
      /** The ⋯ menu's first group: which of a task's properties the rows show. */
      display: 'Show on each row',
      dueDates: 'Due dates',
      priority: 'Priority',
      labels: 'Labels',
      rename: 'Rename list',
      deleteList: 'Delete list',
      /** The banner across the top of reorder mode. */
      reorderHint:
        'Drag to rearrange. Completing, editing and swiping are off until you tap Done.',
      /** Completed rows have no order anyone arranges, so the mode hides them. */
      reorderCompleted: 'Completed tasks are hidden while you rearrange.',
      /** A list Gather may read and not write (ADR-0021). */
      readOnly:
        'This list lives in {provider}. Gather can read it, but not write to it — so there is no composer here.',
      /** Only a provider-backed list has anything to pull for. */
      refreshed: 'Synced just now',
      /** A linked list on its first fetch, before it has any rows to show. */
      loading: 'Loading from {provider}…',
      /** The provider refused the stored connection (ADR-0021). */
      reconnect:
        'Gather lost its connection to {provider}. Reconnect it in Gather on the web, then pull down to refresh.',
      /** The provider did not answer; whatever rows were loaded before stay. */
      failed:
        'Could not load this list from {provider}. Pull down to try again.',
      /** The row's hold menu. */
      complete: 'Complete',
      uncomplete: 'Mark as not done',
      renameTask: 'Rename',
      dueDate: 'Due date',
      moveToList: 'Move to list…',
      /** The alert before a delete, which is permanent in Gather today. */
      deleteTitle: 'Delete “{title}”?',
      deleteBody: 'This cannot be undone.',
    },

    task: {
      titlePlaceholder: 'What needs doing?',
      due: 'Due date',
      priority: 'Priority',
      labels: 'Labels',
      list: 'List',
      notes: 'Notes',
      notesPlaceholder: 'Anything worth writing down',
      /** The value shown on a row nobody has set. */
      unset: 'None',
      /** Back is done — the screen says so once, rather than growing a button. */
      autosaved: 'Changes are kept as you make them. Back is done.',
      delete: 'Delete task',
      /** The shortcuts above the month grid. */
      today: 'Today',
      tomorrow: 'Tomorrow',
      weekend: 'This weekend',
      clear: 'No date',
      /** Keyed by the schema's 1–4, so a fifth priority is a type error. */
      priorities: {
        1: 'Urgent',
        2: 'High',
        3: 'Normal',
        4: 'Low',
      },
      /** The label editor's field. */
      addLabel: 'Add a label',
      /**
       * The label sheet's two groups. There is no label table behind them: a
       * label exists because a task carries the word, so "used in this Group"
       * is a query over the tasks and empties itself when the last one lets go.
       */
      labelsOnTask: 'On this task',
      labelsInGroup: 'Used in this Group',
      labelsNone: 'No labels yet.',
      /** Read out on the cross inside a label that is on the task. */
      removeLabel: 'Remove {label}',
      /** The hold menu on a label nobody has put on this task yet. */
      renameLabelEverywhere: 'Rename everywhere',
      removeLabelEverywhere: 'Remove from every task',
      /** The field, while it is renaming a label rather than adding one. */
      renamingLabel: 'Rename {label} to',
      /** Announced on the calendar's month arrows. */
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      overdue: 'Overdue',
    },
  },

  /** The Notes Module's own words, on the same terms as `tasks` above. */
  notes: {
    title: 'Notes',
    search: 'Search notes',
    pinned: 'Pinned',
    recent: 'Recent',
    empty: 'No notes yet.',
    /** Nothing matched the field — never an add button (mobile-interaction). */
    noMatches: 'Nothing called “{query}”.',
    newNote: 'New note',
    untitled: 'Untitled note',
    titlePlaceholder: 'Title',
    bodyPlaceholder: 'Start writing…',
    /** The meta line under a note's title. */
    editedBy: 'Edited {when} by {name}',
    editedByYou: 'Edited {when} by you',
    edited: 'Edited {when}',
    pin: 'Pin',
    unpin: 'Unpin',
    delete: 'Delete note',
    deleteTitle: 'Delete “{title}”?',
    /** The formatting bar above the keyboard. Drawn, not wired — see the screen. */
    formatting:
      'Formatting is drawn, not wired: this prototype is about the shape.',
    /** A note edited today says so rather than giving the date. */
    today: 'Today',
    /** The alert before a delete, which is permanent in Gather today. */
    deleteBody: 'This cannot be undone.',
  },

  /**
   * Settings → Labs: the prototypes, and only them.
   *
   * Development builds only: `settings/labs/_layout.tsx` redirects in a release
   * and Settings lists the row only on `__DEV__`. A word a shipped Module uses
   * does not belong here. These are still translated, for the reason ADR-0011 gives: an English literal in `src/` is
   * a habit, and the one place it would be excused is the place the next
   * screen gets copied from.
   *
   * Fixture *content* — event names, calendar names — is deliberately not
   * here. Content is never translated (ADR-0011), and made-up content is still
   * content.
   */
  labs: {
    title: 'Labs',
    /** Under the heading, saying what the whole section is. */
    description:
      'Prototypes of screens that are still being decided. Development builds only.',
    /** The strip every prototype screen carries, so nobody mistakes it for the app. */
    banner: 'Prototype. The data is made up and only lives in this session.',

    entries: {
      calendar: 'Calendar — the month, the cell and the composer',
    },

    /**
     * What a Labs row says about the prototype it links to. The question and
     * the verdict are the two halves that keep the section readable as it
     * accumulates: a prototype nobody can remember the point of is noise.
     */
    entry: {
      /** Above the one-line question the prototype was built to answer. */
      question: 'The question',
      built: 'Built {date}',
      verdict: 'Verdict',
      /** A prototype still being lived with. */
      undecided: 'Still being decided.',
      open: 'Open',
      /** The `?…=` combinations a row links straight to. */
      variants: 'Variants',
    },

    /**
     * The variant switcher every Labs screen carries. It is chrome, not
     * design — three independent axes, so a person can mix an answer rather
     * than pick a whole screen.
     */
    variants: {
      show: 'Show the variant switcher',
      hide: 'Hide the variant switcher',
      /** Marks the option the design canvas already argued for. */
      chosen: 'Canvas verdict',
    },

    finance: {
      title: 'Finance lab',
      description:
        'Houses and mortgages, Portfolio, and Net worth. Development builds only.',
      open: 'Open Finance lab',
    },

    calendar: {
      title: 'Calendar',
      productionPreview: 'Open the production calendar',
      /** The one-line question, shown on the Labs row. */
      question:
        'Does one screen with three layouts read as a preference, and does the composer clear the keyboard?',
      /** Jumps the grid and the agenda back to today. */
      today: 'Today',
      /** The three layouts, named in the switcher and in the view menu. */
      views: {
        month: 'Month',
        week: 'Week',
        agenda: 'Agenda',
      },
      /** The view menu's second section — visibility, not layout. */
      calendars: 'Calendars…',
      /** Read on the ellipsis that opens the view menu. */
      viewMenu: 'Change the view',
      newEvent: 'New event',
      /** The selected day has nothing on it. */
      nothingOn: 'Nothing on.',
      /** The agenda has run out of days with anything on them. */
      nothingAhead: 'Nothing else this month.',
      /** An empty week in the agenda, so a gap reads as a gap and not a bug. */
      quietWeek: 'A quiet week.',
      /** The composer. The name is the field everything else hangs off. */
      /**
       * Settled on a device on 2 September 2026. The three axes stay in the
       * code — a winner does not delete the alternatives — but this is what
       * the real Module is built from.
       */
      verdict:
        'The view menu wins, and it gained a swipe: sideways pages the month, up and down is week↔month. A cell shows one initial and a count, never a row of them. The composer is the card. Still open: whether the drag-only header (nav=fluid) is worth keeping at all.',
      namePlaceholder: 'Event name',
      /** The chips beneath it, in the order they sit in the strip. */
      chips: {
        more: 'More',
        calendar: 'Calendar',
        date: 'Date',
        time: 'Time',
        who: 'Who',
        allDay: 'All-day',
        where: 'Where',
        notes: 'Notes',
        repeats: 'Repeats…',
      },
      /** The panes those chips open. */
      wherePlaceholder: 'Where',
      notesPlaceholder: 'Notes',
      startsAt: 'Starts at',
      lasts: 'Lasts',
      durations: {
        m30: '30 min',
        h1: '1 hour',
        h2: '2 hours',
      },
      /** How often it comes round. Prototype only: nothing is expanded. */
      repeatRules: {
        never: 'Never',
        daily: 'Every day',
        weekly: 'Every week',
        monthly: 'Every month',
      },
      /** The round button: commits a new event, dismisses an edit. */
      commit: 'Add event',
      dismiss: 'Done',
      /** The edit card's own overflow. */
      duplicate: 'Duplicate',
      deleteEvent: 'Delete event',
      /** The inline composer's one line, which names the day it will land on. */
      addOn: 'Add an event on {day}…',
      /** Said once under the fluid header, because a gesture has no label. */
      dragHint: 'Drag the calendar down for the month.',
      /** Read on the picker's month arrows and on a day. */
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      /** The date picker's shortcuts, above the grid. */
      todayShort: 'Today',
      tomorrow: 'Tomorrow',
      weekend: 'Weekend',
      /** Spoken on a cell, after the date: who is on it, or what is. */
      marksNobody: 'nobody assigned',
      /** The three axes the switcher offers, and their options. */
      axes: {
        nav: 'Changing the view',
        navMenu: 'View menu',
        navSegmented: 'Segmented',
        navFluid: 'Drag to open',
        cell: 'A month cell',
        cellMarks: 'Who',
        cellBars: 'Bars',
        composer: 'Adding an event',
        composerCard: 'Card',
        composerSheet: 'Sheet',
        composerInline: 'One line',
      },
      /** The prototype writes nothing, and says so where a save would be. */
      notSaved: 'Nothing here is saved.',
    },
  },
}
