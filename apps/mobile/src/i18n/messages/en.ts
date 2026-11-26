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
   * Spoken accessibility terms that only the phone needs — e.g. iOS has no
   * native radio trait, so `radioProps` announces this in the app's language.
   */
  a11y: {
    radioButton: 'radio button',
  },

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

  /** Meal preferences (APP-318): the screen and the planner's filter words. */
  mealPreferences: coreEn.mealPreferences,

  /** Recipes' nutrition panel. */
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
  energy: coreEn.energy,

  /**
   * Loyalty cards: the shared tree, plus the words only the phone says —
   * the camera scanner and the till screen have no web counterpart.
   */
  loyaltyCards: {
    ...coreEn.loyaltyCards,
    scan: {
      title: 'Scan the card',
      hint: 'Hold the card’s barcode inside the frame.',
      typeInstead: 'Type the number instead',
      askTitle: 'Scan the card with the camera',
      askBody:
        'Gather uses the camera only to read the card’s barcode. Nothing is recorded or kept.',
      allow: 'Use the camera',
      denied:
        'Gather may not use the camera. Turn it on in Settings to scan, or type the number.',
      openSettings: 'Open Settings',
      unavailable:
        'The camera is not available on this device. Type the number instead.',
      scanned: 'Scanned {format}: {number}',
      scanAgain: 'Scan again',
      suggestion: 'This looks like a {store} card.',
      useSuggestion: 'Use {store}',
      frame: 'Camera view for scanning a barcode',
    },
    till: {
      edit: 'Edit card',
      delete: 'Delete card',
      front: 'Front of the {store} card',
      back: 'Back of the {store} card',
    },
    /** The auth gate's offline fallback: a saved copy, shown without Gather. */
    offline: {
      notice: 'Offline. These are your cards as saved on this phone.',
      back: 'All cards',
    },
    list: {
      /** When a card was last shown, in Home's activity words. */
      when: coreEn.shell.activity,
    },
    form: {
      ...coreEn.loyaltyCards.form,
      chooseFormat: 'Choose the barcode type',
      takePhoto: 'Take a photo',
      choosePhoto: 'Choose a photo',
      replacePhoto: 'Replace',
      removePhoto: 'Remove',
      photoDenied: 'Gather may not use the camera or photos. Turn it on in Settings.',
      photoFailed: 'That photo could not be added.',
      /** The store colour swatches' spoken names (`STORE_COLOR_PRESETS`). */
      colors: {
        slate: 'Slate',
        red: 'Red',
        orange: 'Orange',
        yellow: 'Yellow',
        green: 'Green',
        teal: 'Teal',
        blue: 'Blue',
        purple: 'Purple',
        pink: 'Pink',
        brown: 'Brown',
      },
    },
  },

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
      loyaltyCard: 'Loyalty card',
    },
    kinds: { cheese: 'Cheese', wine: 'Wine', beer: 'Beer' },
    /** A search pushed from a Module (APP-613): its title and its header button. */
    inModule: 'Search in {module}',
    /** The field's placeholder there. */
    placeholderModule: 'Search {module}',
    /** The filter chips at the top of the results (APP-613). */
    filters: {
      label: 'Filters',
      /** Every chip's VoiceOver label. */
      chip: '{filter}: {value}. Tap to change.',
      module: 'Module',
      allModules: 'All Modules',
      /** The selected Module chip's ✕. */
      clearModule: 'Search all Modules',
      /** The Module sheet's title. */
      sheetTitle: 'Search in',
      who: 'Who',
      anyone: 'Anyone',
      me: 'Me',
      when: 'When',
      anytime: 'Any time',
      whenValues: {
        today: 'Today',
        week: 'This week',
        month: 'This month',
        earlier: 'Earlier',
      },
      status: 'Status',
      anyStatus: 'Any',
      statusValues: { open: 'Open', done: 'Done' },
      noResults: 'Nothing found with these filters.',
      clear: 'Clear filters',
    },
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

    /**
     * The app icon's long-press menu (APP-207): iOS Home Screen quick actions
     * and Android shortcuts. Each opens the quick-actions sheet.
     */
    homeScreenActions: {
      loyaltyCard: 'Show loyalty card',
      addTask: 'Add task',
      quick: 'Quick actions',
    },

    add: {
      /** The quick-actions sheet (APP-206): show what you need, or add. */
      title: 'Quick · {group}',
      subtitle: 'Show what you need, or add something',
      back: 'Back to actions',
      saved: 'Added: {items}',
      cards: {
        heading: coreEn.modules.byId['loyalty-cards'].label,
        all: 'All cards',
        /** A card's accessible name; `{store}` is the store. */
        show: '{store}, show card',
        emptyTitle: 'No loyalty cards yet',
        emptyBody: 'Scan one and it waits here for the till.',
        scan: 'Scan',
      },
      addHeading: 'Add',
      /**
       * `label` is the accessible name, `short` the grid tile's words, and
       * `module` the Module named under them.
       */
      actions: {
        'cheese-tasting': {
          label: coreEn.tastings.kinds.cheese.launcher,
          short: 'Cheese tasting',
          module: coreEn.modules.byId.cheeses.label,
        },
        'wine-tasting': {
          label: coreEn.tastings.kinds.wine.launcher,
          short: 'Wine tasting',
          module: coreEn.modules.byId.wines.label,
        },
        'beer-tasting': {
          label: coreEn.tastings.kinds.beer.launcher,
          short: 'Beer tasting',
          module: coreEn.modules.byId.beers.label,
        },
        'task-new': {
          label: 'Add a task',
          short: 'Task',
          module: coreEn.modules.byId.tasks.label,
        },
        'recipe-import': {
          label: 'Import from a link',
          short: 'Import recipe',
          module: coreEn.modules.byId.recipes.label,
        },
        'loyalty-card-add': {
          label: 'Add loyalty card',
          short: 'Scan card',
          module: coreEn.modules.byId['loyalty-cards'].label,
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
      /** Today: the date, the Now card, the rail, Anytime today and Pinned. */
      today: coreEn.shell.today,
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
      /** VoiceOver's actions on a row in Edit mode, which cannot drag a grip. */
      moveUpAction: 'Move up',
      moveDownAction: 'Move down',
      /** Said after one of them. `{item}` is a module or a category; positions count from 1. */
      moved: '{item} moved to position {position} of {total}',
    },

    placeholder: coreEn.shell.placeholder,

    switcher: {
      action: coreEn.shell.groupSwitcher.label,
      title: coreEn.shell.groupSwitcher.pick,
      shared: coreEn.shell.groupSwitcher.shared,
      /** Marks the row you are already in, for a reader who cannot see the tick. */
      current: 'Current group',
    },

    /**
     * The Groups screen: the households you are in, the Current Group's invite
     * code, the two ways to get another, and the ways out of the current one.
     */
    groups: {
      ...coreEn.shell.groups,
      /**
       * Not the web's. The web's intro says "Open one to change its name,
       * share its invite code, or leave it": the phone does not rename, and
       * it acts on the Current Group rather than one you open, which you
       * switch somewhere else entirely (ADR-0015: on Home). Shared words stop
       * being shared the moment they describe a surface the other client does
       * not have.
       */
      intro:
        'The households you are in. Home is where you switch between them. Below, invite somebody to the current one, start another, or join somebody else’s.',
      /**
       * The Current Group's invite code, in the web's words, and the native
       * share sheet's text. A code, not a link: invite links are APP-84.
       */
      invite: {
        title: coreEn.settings.group.inviteCode,
        note: coreEn.settings.group.inviteCodeNote,
        failed: coreEn.settings.group.inviteCodeFailed,
        share: 'Share code',
        shareMessage:
          'Join {group} on Gather: under Groups, choose “{join}” and enter {code}.',
      },
      /** The zone of the Current Group's "today", in the web's words. */
      timeZone: {
        title: coreEn.settings.group.timeZone,
        note: coreEn.settings.group.timeZoneNote,
        unset: coreEn.settings.group.timeZoneUnset,
        useDevice: coreEn.settings.group.timeZoneUseDevice,
        clear: coreEn.settings.group.timeZoneClear,
        failed: coreEn.settings.group.timeZoneFailed,
        adminOnly: coreEn.settings.group.timeZoneAdminOnly,
        choose: coreEn.settings.group.timeZoneChoose,
        search: coreEn.settings.group.timeZoneSearch,
        noMatches: coreEn.settings.group.timeZoneNoMatches,
        refusals: coreEn.settings.group.timeZoneRefusals,
        places: coreEn.settings.group.timeZonePlaces,
      },
      /**
       * Leaving the Current Group, in the web's words. The server refuses the
       * only admin while anyone else is still in it (`groups.leaveGroup`); the
       * phone cannot hand the role on, so the note sends them to the web. The
       * last Member deletes the Group instead (`lastMember`).
       */
      leave: {
        button: coreEn.settings.group.leaveButton,
        title: coreEn.settings.group.leaveTitle,
        body: coreEn.settings.group.leaveBody,
        confirm: coreEn.settings.group.leaveConfirm,
        failed: coreEn.settings.group.leaveFailed,
        lastMember: coreEn.settings.group.lastMember,
        onlyAdmin:
          'You are the only admin. Make somebody else an admin in this group’s settings on the web, then leave.',
      },
      /**
       * Deleting the Current Group, in the web's words (`settings.group`). The
       * server allows it only to its last Member.
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
    /** Opens the web's About page, where the data sources are credited. */
    dataSources: coreEn.shell.about.dataSources.title,

    /**
     * The line at the foot of Settings. The update is `update <label>`, where
     * the label is the release standard's, or `no update` on the embedded bundle.
     */
    buildInfo: {
      line: 'Version {version} ({build}) · {update} · {channel}',
      update: 'update {label}',
      noUpdate: 'no update',
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

    /**
     * A Module's own settings page (APP-611). Two doors lead to it: the gear
     * at the right of the Module's bar, and its row under Modules here.
     * `{module}` is the Module's name as the catalogue spells it.
     */
    modulePage: {
      title: coreEn.shell.modulePage.settingsTitle,
      /** The gear's accessible name. */
      open: coreEn.shell.modulePage.settingsOf,
      /** Under the Modules group: the rows are the gear's pages. */
      footer: 'The same pages as the gear at the top right of each Module.',
      /** Under a group of settings written to this phone only. */
      phoneOnly: 'Kept on this phone, the same in every group.',
      /** Under a grocery list's settings; `{list}` and `{group}` are names. */
      sharedList: coreEn.shell.modulePage.settingsSharedList,
      /** Under settings the whole Group shares; `{group}` is its name. */
      shared: coreEn.shell.modulePage.settingsShared,
    },
  },

  /**
   * Sentry's report form, opened by a shake or the Report a problem row in
   * Settings (APP-439). Sentry draws the form; these are its words.
   */
  feedback: {
    report: 'Report a problem',
    message: 'What went wrong?',
    placeholder: 'What happened, and what did you expect?',
    required: '(required)',
    submit: 'Send report',
    cancel: 'Cancel',
    add: 'Add a screenshot',
    take: 'Take a screenshot',
    remove: 'Remove screenshot',
    error: 'The report could not be sent. Try again.',
    success: 'Thanks. Your report was sent.',
    /** The row's answer in a build that does not report to Sentry. */
    unavailable:
      'Reporting a problem is not available in this version of Gather.',
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

    /** The row that opens the AppElent account portal in the in-app browser. */
    portal: coreEn.settings.accountPortal,

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
      addOnWeb:
        'Adding or removing an address is done at account.appelent.nl — choose “Manage your AppElent account” under Account.',
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

    /** The end of the account; the web's Danger zone says the same. */
    deleteAccount: coreEn.settings.deleteAccount,

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
    deleteTitle: 'Delete “{title}”?',
    deleteBody: 'This cannot be undone.',
    /**
     * Groceries' In stock (APP-314, designs/groceries section 7): the staples
     * a household keeps, in stock or running low. It replaced the Pantry.
     */
    inStock: {
      title: 'In stock',
      running: { one: '{count} running low', other: '{count} running low' },
      staples: { one: '{count} staple', other: '{count} staples' },
      sub: 'What you always want in the house',
      onList: 'On {list}',
      noList: 'No grocery list yet',
      inStock: 'In stock',
      low: 'Running low',
      toLow: '{name}: in stock, tap for running low',
      toInStock: '{name}: running low, tap for in stock',
      add: 'Add a staple',
      footnote:
        'Check off a staple on the list and it is back in stock here. Recipe and week menu start in-stock items unticked.',
    },
  },

  /**
   * The week menu (`modules/kitchen/meal-planner`, designs/meal-planner §1).
   * A day has one meal per enabled slot; a plural is `{ one, other }` with
   * `{count}`.
   */
  mealPlanner: coreEn.mealPlanner,

  /**
   * Social sign-in under the email form (`SocialButtons`). Apple on iOS draws
   * Apple's own localized button, so `apple` is only read on Android.
   */
  social: {
    heading: 'Or continue with',
    apple: 'Continue with Apple',
    microsoft: 'Continue with Microsoft',
    /**
     * Clerk stopped short of a session: a sign-up missing a field, or a sign-in
     * that needs a second factor. The web forms can finish both.
     */
    incomplete:
      "Your account needs another step this app doesn't support yet. Finish it on the web, then sign in here.",
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
    /** Moves to the next field, above the keypad. */
    next: 'Next',
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
    codeAttemptsExceeded: coreEn.auth.errors.codeAttemptsExceeded,
    emailCodeUnavailable: coreEn.auth.signIn.emailCode.unavailable,
    needsExtraStep: coreEn.auth.errors.needsExtraStep,
    noSecondFactor: coreEn.auth.errors.noSecondFactor,
    required: 'This cannot be empty.',
    tooManyRequests: 'Too many attempts. Wait a moment and try again.',
    openPageFailed: 'This page could not be opened. Try again.',
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
      'grocery-list': 'Which grocery list?',
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
   * The keyboard composer (APP-587): one shell, pinned to the top of the
   * keyboard, for a new task now and a new note or event later. Its own
   * chrome and the task's chips; the field names are the task form's.
   */
  composer: {
    /** The drag handle and the button top right, both ways. */
    expand: 'Expand',
    collapse: 'Collapse',
    /** The + button: the details not always shown. */
    more: 'More details',
    /** The + menu's last entry: the task form, with everything kept. */
    allDetails: 'All details',
    /** The last entry in a set chip's menu. */
    remove: 'Remove',
    save: 'Save',
    /** The dim scrim behind the composer, for VoiceOver. */
    close: 'Close',
    /** The handle of a composer with one size (a grocery item's, APP-664). */
    closeKeeping: 'Close, the draft is kept',
    /** The add button on the Tasks screens. */
    addTask: 'Add task',
    taskTitle: 'Task name',
    description: 'Description',
    taskBody: 'Description, links, what’s needed…',
    /** The add button on Notes (APP-588), and the note's body field. */
    addNote: 'New note',
    noteBody: 'Start typing…',
    /** A note's save failed while the composer still showed it. */
    noteFailed: 'That note could not be saved. Try again.',
    /** A note's save failed once the composer had moved on or closed. */
    noteNotSaved: '“{title}” was not saved.',
    label: 'Label',
    /** Starts a #label in the field, where it is recognised as typed. */
    newLabel: 'New label…',
    /** The Repeat menu's last entry: the Repeat sheet. */
    customRepeat: 'Custom…',
    date: {
      label: 'Date',
      weekend: 'This weekend',
      nextWeek: 'Next week',
      pick: 'Pick a date…',
    },
    time: {
      pick: 'Pick a time…',
    },
    /** The task went in; a note or a reminder chosen with it did not. */
    detailsFailed: 'The task was added, but not all of its details.',
    /** A save that failed once the composer had moved on or closed. */
    notAdded: '“{title}” was not added.',
    tryAgain: 'Try again',
    discard: 'Discard',
    ok: 'OK',
    /** The grocery item composer (APP-664, designs/groceries/composer_final.md). */
    grocery: {
      /** The bar at the bottom of a grocery list, which opens the composer. */
      bar: 'Add an item, e.g. 2 milk',
      barLabel: 'Add an item',
      title: 'Item, e.g. 2 milk',
      titleLabel: 'Add an item to {list}',
      note: 'Note',
      notePlaceholder: 'Note, e.g. the large one',
      /** Keeps the item in In stock too. */
      staple: 'Staple',
      unit: 'Unit',
      send: 'Add',
      /** The status line, for what this composer added since it opened. */
      added: '{name} added',
      addedMany: '{count} added: {names}',
      /** A completion whose amount went onto an item already on the list. */
      merged: '{name} updated: {amount}',
      already: '{name} is already on the list',
      undo: 'Undo',
      undoFailed: 'Undo did not work. Try again.',
      /** The item went in; its aisle, note or staple did not. */
      detailsFailed: 'The item was added, but not all of its details.',
    },
    /** The add button on Calendar (APP-589), and the event's fields. */
    addEvent: 'Add event',
    eventTitle: 'What’s happening?',
    eventNote: 'Note',
    eventBody: 'Note: what to bring, address…',
    /** An event's save failed while the composer still showed it. */
    eventFailed: 'That event could not be saved. Try again.',
    /** An event's save failed once the composer had moved on or closed. */
    eventNotSaved: '“{title}” was not saved.',
  },

  /**
   * The Tasks Module's own words: the phone's, not `coreEn.tasks`. The web's
   * tree for the same Module is a different shape, and merging the two is
   * ADR-0017 work; until then a second `tasks` key here is a duplicate-key
   * type error, so the two cannot be confused silently.
   */
  tasks: {
    /** The summary under a task screen's large title. */
    count: coreEn.tasks.count,
    /** APP-306: the New list sheet, list kinds and their faces, shared with the web. */
    newList: coreEn.tasks.newList,
    appearance: coreEn.tasks.appearance,
    kinds: coreEn.tasks.kinds,
    icons: coreEn.tasks.icons,
    colors: coreEn.tasks.colors,
    starters: coreEn.tasks.starters,
    starterSections: coreEn.tasks.starterSections,
    packing: coreEn.tasks.packing,
    /** APP-304: subtasks, shared with the web. */
    subtasks: coreEn.tasks.subtasks,
    linkedWrite: coreEn.tasks.linkedWrite,
    repeat: coreEn.tasks.repeat,
    wishlist: coreEn.tasks.wishlist,
    grocery: coreEn.tasks.grocery,
    assignee: coreEn.tasks.assignee,
    /** APP-301: the smart lists on the index, shared with the web. */
    smart: coreEn.tasks.smart,
    title: 'Tasks',

    quickAdd: coreEn.tasks.quickAdd,
    today: coreEn.tasks.index.today,
    todayEmpty: coreEn.tasks.index.todayEmpty,
    lists: coreEn.tasks.index.lists,
    open: coreEn.tasks.index.open,
    openOne: coreEn.tasks.index.openOne,
    allDone: coreEn.tasks.index.allDone,
    linked: coreEn.tasks.index.linked,
    /** Which list a task on the Today strip came from. */
    inList: 'in {list}',
    notLoaded: coreEn.tasks.index.notLoaded,

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
      /** Reorder mode's banner on a grocery list, arranged in its aisles (APP-522). */
      reorderAislesHint:
        'Drag an item under another aisle to move it there. Checking, editing and swiping are off until you tap Done.',
      reorderChecked: 'Checked items are hidden while you rearrange.',
      /** Reorder mode put back to the saved order after a refused drop (APP-534). */
      reorderReset: "That move didn't save. This is the list as it is now.",
      /** VoiceOver's actions on a row in reorder mode, which cannot drag a grip (APP-572). */
      moveUpAction: 'Move up',
      moveDownAction: 'Move down',
      /** Said after one of them. Positions count from 1, within the section. */
      movedTo: '{task} moved to position {position} of {total}',
      movedToSection: '{task} moved to {section}, position {position} of {total}',
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

    sections: coreEn.tasks.sections,

    task: coreEn.tasks.task,
  },

  /** The Notes Module's own words, on the same terms as `tasks` above. */
  notes: {
    length: coreEn.notes.length,
    refusals: coreEn.notes.refusals,
    title: 'Notes',
    pinned: 'Pinned',
    recent: 'Recent',
    empty: 'No notes yet.',
    showMore: 'Show more notes',
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
    /** A save failed for another reason than the note's own rules (APP-829). */
    notSaved: 'Not saved yet. It is tried again when you leave this note.',
    /** Kept unsaved text, not put back because its field changed since. */
    keptNotPutBack:
      'This note changed since you left it, so your unsaved text was not put back.',
    putBack: 'Put back my text',
    discardKept: 'Discard my text',
  },

  /**
   * Settings → Notifications, and the one line before iOS's own permission
   * sheet (APP-298). The switches are the person's in every Group; a Group's
   * mute is on top of them. The prompt is shown only when somebody sets a
   * reminder, is assigned something, or asks here, never at launch.
   */
  notifications: {
    title: 'Notifications',
    description:
      'These follow your account to every phone you sign in on, and apply in every group.',
    tasks: 'Tasks',
    calendar: 'Calendar',
    reminders: 'Reminders',
    assignments: 'Assigned to me',
    /** The accessible name of a switch: `{area}` is Tasks or Calendar. */
    switchLabel: '{area}: {kind}',
    groups: 'Groups',
    groupsDescription: 'A muted group sends you nothing, whatever is on above.',
    /** `{group}` is the group's name. */
    muteLabel: 'Notifications from {group}',
    permission: {
      off: 'Notifications are off for Gather on this phone.',
      allow: 'Turn on notifications',
      denied:
        'Notifications are turned off for Gather in iOS Settings, so this phone gets none of the above.',
      openSettings: 'Open iOS Settings',
      /** The title of the alert shown before iOS asks. */
      askTitle: 'Get notified on this phone?',
      /** The one line before iOS's sheet, by what the person just did. */
      ask: {
        reminder: 'Gather sends your reminder to this phone as a notification.',
        assignment:
          'Gather tells you on this phone when somebody gives you something to do.',
      },
      notNow: 'Not now',
      continue: 'Continue',
    },
    /** The button on a task reminder's notification that completes it. */
    actions: { done: 'Done' },
    failed: 'Could not save that. Try again.',
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
   * Fixture *content* is deliberately not here. Content is never translated
   * (ADR-0011), and made-up content is still content.
   */
  labs: {
    title: 'Labs',
    /** Under the heading, saying what the whole section is. */
    description:
      'Prototypes of screens that are still being decided. Development builds only.',

    finance: {
      title: 'Finance lab',
      description:
        'Houses and mortgages, Portfolio, and Net worth. Development builds only.',
      open: 'Open Finance lab',
    },
  },
}
