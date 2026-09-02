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
   * The Finances Module's words, taken whole from the shared tree for the
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
      intro: 'Welcome to Gather. Find every module for this group in All.',
      personalSubtitle: coreEn.shell.home.personalSubtitle,
      sharedSubtitle: coreEn.shell.home.sharedSubtitle,
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
   * Who you are, what can be changed about it, and the two ways out.
   *
   * It used to say all of this was managed on the web, which stopped being
   * true the moment the phone could create an account: an app that signs
   * people up has to let them leave from the same place (App Store guideline
   * 5.1.1(v)).
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
    photo: 'Photo',

    /** Changing the name Clerk holds. Both halves, because Clerk stores both. */
    editName: {
      title: 'Name',
      description: 'What other members of your Groups see.',
      first: 'First name',
      last: 'Last name',
      saved: 'Name updated',
    },

    changePassword: {
      title: 'Password',
      description:
        'Changing it signs you out everywhere else, on every other phone and browser.',
      current: 'Current password',
      next: 'New password',
      submit: 'Change password',
      saved: 'Password changed',
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
      empty: 'No other devices.',
    },

    /** Changing the picture. It is Clerk's, not the household's storage. */
    picture: {
      change: 'Change photo',
      take: 'Take a photo',
      choose: 'Choose a photo',
      remove: 'Remove photo',
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
      confirm: 'Delete',
      failed: 'Your account could not be deleted. Nothing has been removed.',
      /**
       * The half-way failure, which is real: Convex is purged before Clerk,
       * because the purge needs a signed-in caller and there is none once the
       * Clerk user is gone (ADR-0032). Saying "nothing has been removed" here
       * would be a lie.
       */
      partlyFailed:
        'Your data was deleted, but the account itself could not be. Please contact support.',
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
    add: 'Add',
    name: 'Name',
    quantity: 'Quantity (optional)',
    prepMinutes: 'Preparation time in minutes',
    noMeals: 'No meals yet. Add a quick meal or use a recipe.',
    noPantry: 'Nothing in the pantry yet.',
    noCalendars: 'No calendars yet.',
    noEvents: 'No events this month.',
    chooseList: 'Choose grocery list',
    noGroceryList: 'Choose a task list for groceries.',
    quick: 'Quick under {minutes} minutes',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    randomizeWeek: 'Randomize unplanned week',
    mealLibrary: 'Quick meals',
    chooseDinner: 'Choose dinner',
    changeList: 'Change or clear list',
    random: 'Random dinner',
    clearDinner: 'Clear dinner',
    deleteTitle: 'Delete â€œ{title}â€?',
    deleteBody: 'This cannot be undone.',
    newCalendar: 'New calendar',
    newEvent: 'New event',
    eventDate: 'Date (YYYY-MM-DD)',
    startTime: 'Start (HH:MM)',
    endTime: 'End (HH:MM)',
    visible: 'Show calendar',
    hidden: 'Hide calendar',
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
    showLess: 'Show less',
    retry: 'Try again',
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
      'Start a group below or join somebody else’s with their invite code.',
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

  /**
   * Settings → Labs: the Tasks and Notes prototypes.
   *
   * These are dev-only screens driven by fixtures — nothing under `labs` ever
   * reaches a release build, because `settingsSections` is only handed
   * `labs: true` on `__DEV__`. They are still translated, for the reason
   * ADR-0011 gives: an English literal in `src/` is a habit, and the one place
   * it would be excused is the place the next screen gets copied from.
   *
   * Fixture *content* — task titles, note bodies, list names — is deliberately
   * not here. Content is never translated (ADR-0011), and made-up content is
   * still content.
   */
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
    confirm: 'Save',
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
     * (`docs/mobile-interaction.md`).
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

  labs: {
    title: 'Labs',
    /** Under the heading, saying what the whole section is. */
    description:
      'Prototypes of screens that are still being decided. Development builds only.',
    /** The strip every prototype screen carries, so nobody mistakes it for the app. */
    banner: 'Prototype. The data is made up and only lives in this session.',
    reset: 'Start over with fresh data',

    entries: {
      tasks: 'Tasks — lists, one list, a task',
      editModes: 'Editing a task — three ways',
      notes: 'Notes',
    },

    tasks: {
      title: 'Tasks',
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
    },

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
      /** The detail screen's own title, when the task has no title yet. */
      untitled: 'New task',
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
      renameLabelSave: 'Rename',
      renameLabelCancel: 'Cancel',
      /** Read on the row when a task carries more than one. */
      labelCount: '{count} labels',
      /** Announced on the calendar's month arrows. */
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      overdue: 'Overdue',
    },

    editModes: {
      title: 'Editing a task',
      intro:
        'The same task, edited three ways. Try each and say which one you want the Module to have.',
      detail: 'A screen of its own',
      detailWhy:
        'Every property on one pushed screen. Most taps to reach, most room once you are there, and the only one that scales past four properties.',
      inline: 'In the row, where it sits',
      inlineWhy:
        'Tap the title and type. Fastest for fixing a typo, and it can only ever edit the title.',
      sheet: 'A sheet over the list',
      sheetWhy:
        'Hold the row, edit in a sheet, stay in the list. Keeps your place, but the sheet grows a scrollbar as properties are added.',
      /** The one task all three modes edit, so the comparison is honest. */
      subject: 'The task',
      open: 'Try it',
    },

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
      pin: 'Pin',
      unpin: 'Unpin',
      delete: 'Delete note',
      deleteTitle: 'Delete “{title}”?',
      /** The formatting bar above the keyboard. Drawn, not wired — see the screen. */
      formatting:
        'Formatting is drawn, not wired: this prototype is about the shape.',
    },
  },
}
