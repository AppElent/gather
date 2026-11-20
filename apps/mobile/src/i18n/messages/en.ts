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
    addGroceryItem: 'Add an item…',
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
  mealPlanner: {
    slots: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' },
    choose: {
      breakfast: 'Choose breakfast',
      lunch: 'Choose lunch',
      dinner: 'Choose dinner',
    },
    summary: {
      one: '{count} of 7 dinners planned',
      other: '{count} of 7 dinners planned',
    },
    people: { one: '{count} person', other: '{count} people' },
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    weekLabel: 'Week of {range}',
    more: 'More',
    preferences: 'Meal preferences',
    share: 'Share week menu',
    groceries: 'Groceries',
    busyLabel: 'Busy evening: {title} at {time}',
    allEating: { one: '{count} eating', other: 'All {count} eating' },
    eatingWithout: '{count} eating, without {names}',
    noneEating: 'Nobody eating',
    and: '{rest} and {last}',
    minutes: '{minutes} min',
    without: ', without {names}',
    dragHint:
      'Press and hold a meal to drag it to another day. If that day has a meal, they swap.',
    dragLabel: 'Drag {title} to another day',
    moved: '{title} moved to {day}.',
    swapped: '{title} swapped with {other}.',
    failed: 'That did not work. Please try again.',
    removed: '{title} removed from the week menu.',
    undo: 'Undo',
    shareTitle: 'Week menu {range}',
    shareEmpty: 'Nothing planned yet.',
    weekGroceries: {
      source: 'Week menu {range}',
      range: '{from} to {to}',
      meals: {
        one: '{count} meal · servings per meal from the week menu',
        other: '{count} meals · servings per meal from the week menu',
      },
      days: 'Days that count',
      counts: 'counts',
      notCounted: 'not',
      empty: 'empty',
      dayCounts: '{day}: {meals}, counts',
      dayNotCounted: '{day}: {meals}, does not count',
      dayEmpty: '{day}: nothing planned',
      toCheck: 'No recipe, check these',
      quickMeta: '{weekday} · quick meal, no ingredients known',
      recipeMeta: '{weekday} · recipe without ingredients',
      addSomething: 'Add something',
      addSomethingLabel: 'Add something for {title}',
      fromOne: '{title} · {day}',
      fromTwo: '{first}, {second}',
      fromMany: { one: '{count} recipe', other: '{count} recipes' },
      footnote:
        'Merged with what is already there. Do this again for this week and only what is new is added.',
      nothingPlanned: 'Nothing in this week menu yet. Plan a meal first.',
    },
    meal: {
      done: 'Done',
      recipe: 'recipe',
      quickMeal: 'quick meal',
      whoEats: "Who's eating",
      fromCalendar: 'From the calendar: {items}',
      calendarItem: '{name}, {title} {time}',
      servings: 'Servings',
      servingsFollow: "Same as who's eating",
      servingsAdjusted: 'Adjusted, eating: {count}',
      fewer: 'Fewer servings',
      moreServings: 'More servings',
      moveTo: 'Move to',
      hasMeal: '{day}, has a meal',
      swaps: 'Swaps with {title} on {day}.',
      moves: '{title} goes to {day}. {weekday} becomes empty.',
      note: 'Note',
      notePlaceholder: 'For example: make extra for lunch',
      openRecipe: 'Open recipe',
      somethingElse: 'Something else',
      somethingElseSub: 'Pick another recipe for {weekday}',
      groceries: 'Groceries for this recipe',
      remove: 'Remove from week menu',
    },
    pick: {
      title: '{slot} {weekday}',
      search: { one: 'Search {count} recipe', other: 'Search {count} recipes' },
      matches: 'Matches preferences',
      upTo: 'Up to {minutes} min',
      hidden: {
        one: '{count} recipe hidden by your preferences ({reasons}). Tap Matches preferences to see it.',
        other:
          '{count} recipes hidden by your preferences ({reasons}). Tap Matches preferences to see them.',
      },
      stars: '{rating} stars',
      alreadyOn: 'Already on {day}',
      noMatches: 'No recipe matches.',
      quickMeals: 'Quick meal without recipe',
      quickMealsFooter: 'A quick meal is a dinner without a recipe, like pizza or leftovers.',
      newQuickMeal: 'New quick meal',
      quickName: 'Name',
      quickMinutes: 'Minutes (optional)',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      deleteTitle: 'Delete “{title}”?',
      deleteBody: 'Meals already planned keep their name.',
    },
    /** Plan mijn week (APP-319): the start sheet. */
    plan: {
      open: 'Plan my week',
      title: 'Plan my week',
      subhead: '{range}. Gather only fills what is still empty, with your own recipes.',
      days: 'Which days',
      dayPlanned: 'planned',
      dayFill: 'fill',
      daySkip: 'skip',
      dayPlannedLabel: '{day}, already planned, stays as it is',
      dayFillLabel: '{day}, will be filled',
      daySkipLabel: '{day}, will be skipped',
      slotDays: '{slot} ({days})',
      wish: 'Wish for this week (optional)',
      wishPlaceholder: 'For example: lots of vegetables, one new thing',
      wishes: {
        moreVeg: 'Lots of vegetables',
        somethingNew: 'One new thing',
        useLow: 'Something with {item}',
      },
      uses: 'Gather takes into account',
      usesPreferences: 'Meal preferences',
      usesPreferencesNone: 'Nothing set yet',
      adjust: 'Adjust',
      noAllergen: 'no {name}',
      dislike: 'rather no {name}',
      meatFree: { one: '{count} meat-free', other: '{count} meat-free' },
      fishDay: '{days} fish',
      maxMinutes: 'up to {minutes} min on weekdays',
      usesCalendar: 'Calendar',
      busyEvening: '{day} {title} {time}: something quick',
      usesEaters: 'Who eats',
      fewerEaters: '{day} without {names}: for {count}',
      usesStock: 'In stock',
      runningLow: '{name} running low',
      cta: { one: 'Make a plan for {count} day', other: 'Make a plan for {count} days' },
      ctaNothing: 'Choose a day to fill',
      working: 'Making a plan…',
      cost: 'Costs 1 smart action · {left} of {limit} left today',
      offline: 'Offline, try again later',
      empty: 'Everything on these days is already planned.',
      failed: 'That did not work. Nothing in your week menu changed.',
      limitTitle: 'Your smart actions for today are used up',
      limitBody: 'You used {used} of {limit} today. Tomorrow you can again. Nothing in your week menu changed.',
      limitHint: 'Choosing yourself still works, with the same preferences as a filter.',
      chooseYourself: 'Choose yourself',
    },
    /** The proposal in the week (APP-319, direction A). */
    proposal: {
      aiTitle: 'Plan from Gather',
      aiBody: 'From your own recipes, following the preferences and the calendar. Accept day by day, or all at once.',
      fallbackTitle: 'Simple plan',
      fallbackBody: 'The smart planner could not be reached. This plan was made with your own rules, without AI. It cost no smart action.',
      eyebrow: 'Proposal · {slot}',
      byRules: 'following your rules',
      accept: 'Accept',
      acceptLabel: 'Accept {title} for {day}',
      somethingElse: 'Something else',
      somethingElseLabel: 'Choose something else for {day}',
      regenerate: 'Another proposal for {day}',
      regenerateNone: 'No other proposal fits {day}.',
      pending: { one: '{count} proposal not saved yet', other: '{count} proposals not saved yet' },
      acceptAll: { one: 'Accept {count}', other: 'Accept all {count}' },
      discard: 'Discard',
      discarded: 'Proposal discarded. Nothing changed.',
      allSaved: 'Everything is in the week menu',
      groceries: 'Groceries for this week',
      done: 'Done',
      justAccepted: 'just accepted',
      taken: 'Something was planned there meanwhile; it stays.',
      gone: 'That proposal has expired.',
      skipped: { one: '{count} day was planned meanwhile and stays.', other: '{count} days were planned meanwhile and stay.' },
    },
  },

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
    repeat: coreEn.tasks.repeat,
    wishlist: coreEn.tasks.wishlist,
    grocery: coreEn.tasks.grocery,
    assignee: coreEn.tasks.assignee,
    /** APP-301: the smart lists on the index, shared with the web. */
    smart: coreEn.tasks.smart,
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

    /** A list's sections (APP-357): the ⋯ menu's Sections sheet and the hold menu. */
    sections: {
      title: 'Sections',
      /** The heading over tasks in no section, on a list that has sections. */
      none: 'No section',
      add: 'Add section',
      newPlaceholder: 'New section',
      empty: 'Nothing in this section yet.',
      moveToSection: 'Move to section…',
      rename: 'Rename',
      moveUp: 'Move up',
      moveDown: 'Move down',
      delete: 'Delete section',
      /** The ellipsis on a row of the Sections sheet. */
      options: 'Options for {name}',
      deleteTitle: 'Delete the section “{name}”?',
      deleteBody: 'Its tasks stay on the list, under No section.',
      hint: 'Move a task between sections with Reorder, or with Move to section in its hold menu.',
      sheetEmpty: 'No sections yet. A section groups tasks, like Kitchen or Clothes.',
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
      /**
       * The Reminder row and its sheet (APP-305). A due date alone sets no
       * reminder; one is chosen, and it goes to the person who chose it.
       */
      reminder: 'Reminder',
      /** The row's value: `{day}` is Today, Tomorrow, a weekday or a date. */
      reminderAt: '{day} {time}',
      reminderSheet: {
        dueDay: 'On the day at 9:00',
        eveningBefore: 'The evening before at 19:00',
        remove: 'No reminder',
        footnote: 'The reminder goes to you, as a notification on your phone.',
        /** On a reminder another Member set, which setting one takes over. */
        someoneElse:
          'Another member set this reminder, and it goes to them. Setting one here makes it yours.',
        passed: 'That time has passed. Pick a later one.',
        failed: 'The reminder could not be set. Try again.',
      },
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
