/**
 * The app around the app: navigation, the account menu, the Group switcher, the
 * pages that are not a Module, and the words Home puts around an activity
 * entry.
 *
 * Grouped by the surface that renders each one, and named for what the string
 * means rather than where it sits — a key called after its position stops being
 * true the first time the layout moves.
 */
export const shell = {
  /**
   * The menu behind the account button at the bottom of the sidebar, and the
   * round one at the top of a phone-width page. There is no topbar: what it
   * used to carry besides the page title lives here.
   */
  accountMenu: {
    label: 'Account menu',
    /** The sidebar's button, which shows your name: a spoken name starts with it. */
    named: '{name}, account menu',
    account: 'Account',
    askGather: 'Ask Gather',
    reportIssue: 'Report a problem',
    switchLanguage: 'Switch to {language}',
  },

  sidebar: {
    label: 'Gather navigation',
    primary: 'Primary',
    footer: 'Settings and account',
    noGroup: 'Pick a group to see its modules.',
    /** The field that opens the jump-to palette; ⌘K is drawn beside it. */
    search: 'Search Gather',
    pinned: 'Pinned',
  },

  /** The phone's destinations, drawn as a floating bar below 768 px. */
  tabBar: {
    label: 'Tabs',
  },

  /**
   * The Add destination: create actions for the Current Group's pinned
   * Modules, each going to that Module's own create flow.
   */
  addMenu: {
    label: 'Add',
    empty: 'Pin a module to add to it from here.',
  },

  /**
   * The trail a nested page draws above itself, and the way back out of it.
   *
   * The sidebar and the dock say which Module you are in; neither can say where
   * you are *inside* it, because the shell renders above the route and does not
   * know that this page is a food, or that food's edit form. So the trail is
   * built by the page, and these are the only two words the shape itself needs:
   * what the landmark is called, and what the back action on a phone says.
   */
  breadcrumbs: {
    label: 'Breadcrumb',
    /** The mobile back action's accessible name — `{page}` is the parent. */
    backTo: 'Back to {page}',
  },

  palette: {
    placeholder: 'Jump to…',
  },

  groupSwitcher: {
    label: 'Switch group',
    /** With a Current Group: its name first, as the sidebar card shows it. */
    named: '{group}, switch group',
    none: 'No group',
    elsewhere: 'Go back to it',
    personal: 'Your own group',
    shared: 'Shared group',
    pick: 'Pick a group',
    manage: 'Manage groups',
  },

  /** The marks a Module carries wherever it is listed. */
  marks: {
    soon: 'Soon',
  },

  /** Navigation item names that belong to no Module. */
  nav: {
    home: 'Home',
    all: 'All',
    allModules: 'All modules',
    add: 'Add',
    search: 'Search',
    groups: 'Groups',
    settings: 'Settings',
    groupSettings: 'Group settings',
  },

  /** What each shell surface is, per surface (the palette, Ask Gather's context). */
  routes: {
    home: {
      title: 'Home',
      subtitle: 'What your group has been up to.',
    },
    all: {
      title: 'All modules',
      subtitle: 'Every module in this group. Pin the ones you use.',
    },
    groupSettings: {
      title: 'Group settings',
      subtitle: 'Settings everyone in this group shares.',
    },
    groups: {
      title: 'Groups',
      subtitle: 'Manage sharing and membership.',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Tune appearance and app preferences.',
    },
    account: {
      title: 'Account',
      subtitle: 'Manage your profile and sign-in details.',
    },
    fallback: {
      title: 'Gather',
      subtitle: 'Shared plans, modules, and context.',
    },
  },

  /** The wash header and detail panel on a Module's page (APP-639, APP-300). */
  modulePage: {
    /** The round search button; `{module}` is the Module's name. */
    searchIn: 'Search in {module}',
    /** The gear, where the Module has a settings page. */
    settingsOf: 'Settings for {module}',
    /** The detail panel's close button in the list-and-detail layout. */
    closePanel: 'Close panel',
  },

  allModules: {
    title: 'All modules',
    intro:
      'Every module is available in this group. Pinning one keeps it in your own navigation here — nobody else in the group sees your choices, and your other groups keep their own.',
    yourPins: 'Your pins',
    nothingPinned:
      'Nothing pinned. Pin a module below to keep it in your navigation.',
    pin: 'Pin',
    unpin: 'Unpin',
    pinModule: 'Pin {module}',
    unpinModule: 'Unpin {module}',
    moveUp: 'Move {module} up',
    moveDown: 'Move {module} down',
    /** Said to a screen reader after a pin moves. Positions count from 1. */
    moved: '{module} moved to position {position} of {total}',
    /** The header button that turns the pins into a reorderable list, and back. */
    reorder: 'Reorder',
    reorderDone: 'Done',
    reorderHint: 'Move each pin up or down, then choose Done.',
    /** A row's mark that this Module is pinned here. */
    pinned: 'Pinned',
  },

  placeholder: {
    planned: 'Module planned',
    whatWillLiveHere: 'What will live here',
    body: 'This module is listed in every group already, so navigation, sharing, and the mobile layout are ready before the full workflow is implemented.',
  },

  notFound: {
    eyebrow: 'Not found',
    title: 'Page not found',
    subtitle: 'Gather has no page at this address.',
    signIn: 'Sign in',
    body: 'The page may have moved, or the link may point to a module that has not been added yet.',
    goHome: 'Go to Gather',
  },

  /** The Groups page: the households you are in, and the two ways to get another. */
  groups: {
    title: 'Groups',
    intro:
      'The households you are in. Open one to change its name, share its invite code, or leave it.',
    yours: 'Your groups',
    personal: 'Personal',
    createTitle: 'New group',
    createBody: 'A household of your own. You start as its admin.',
    createPlaceholder: 'e.g. Wine club',
    createLabel: 'New group name',
    create: 'Create',
    createFailed: 'Could not create that group.',
    joinTitle: 'Join with a code',
    joinBody: "Somebody in the group finds it in that group's settings.",
    joinPlaceholder: '8-char code',
    joinLabel: 'Invite code',
    join: 'Join',
    joinFailed: 'Could not join with that code.',
  },

  /** What the app layout says while the session is still settling. */
  session: {
    stalledTitle: 'Could not finish signing in',
    stalledBody:
      'Gather could not connect your session to the backend. Reloading usually fixes it.',
    reload: 'Reload',
  },

  /** The page a provider's OAuth round-trip comes back to. */
  oauthCallback: {
    finishing: 'Finishing the connection…',
    failedTitle: 'Connection failed',
    backToSettings: 'Back to settings',
    cancelled: 'The connection was cancelled or refused.',
    invalid: 'Invalid connection response — try connecting again.',
    noGroup:
      'That connection came back without a group — start it again from the group’s settings page.',
    failed: 'Connecting failed — try again.',
  },

  /** The public About page. */
  about: {
    eyebrow: 'About Gather',
    title: 'One shared group for everyday coordination',
    /** Also the phone's welcome pitch: name only Modules the store build shows (`PITCHED` in `apps/mobile/src/modules/storeModules.test.ts`). */
    subtitle:
      'Gather keeps shared recipes, plans, lists, tasks, notes, and tasting logs in one place, for the people who share a household.',
    modules:
      'Gather covers recipes, meal planning, groceries, tasks, notes, calendar, shared and recurring costs, savings goals, a baby log, loyalty cards, and cheese, wine, and beer tastings. The phone app leads: some modules arrive on the web once they are ready there.',
    pins: "Every module is available in every group. You pin the ones you use to your own navigation, and the rest stay one click away — your choices are yours alone and never move anybody else's.",
    trademarks:
      'Store names and logos in Loyalty cards are trademarks of their owners and are used only to show which store a card belongs to.',
    /**
     * The attribution the grocery dictionary's licences ask for (APP-369,
     * `packages/core/src/groceries/data/README.md`). Source names stay as
     * their owners write them, in every language.
     */
    dataSources: {
      title: 'Data sources',
      openFoodFacts:
        'Grocery aisles are recognised with product names from Open Food Facts, Open Beauty Facts and Open Products Facts, made available under the Open Database License (ODbL) 1.0. The derived list is available under the same licence.',
      nevo: 'Food names are also based on data from NEVO online version 2025/9.0, RIVM, Bilthoven.',
      licence: 'Open Database License 1.0',
    },
  },

  publicFrame: {
    brand: 'Gather',
    tagline: 'Household plans, shared',
  },

  /** The panel the account menu's Ask Gather item opens. */
  gatherPanel: {
    title: 'Ask Gather',
    close: 'Close Ask Gather',
    context: 'Context: {page}',
    preview: 'Preview',
    notConnected:
      'Automation is not connected yet. Use this panel as a command scratchpad for the active group; real actions will arrive in a later feature.',
    tryAsking: 'Try asking',
    prompts: {
      recent: 'Show me what changed recently',
      plan: 'Draft a plan for this group',
      summarize: 'Summarize this page',
    },
    placeholder: 'Ask Gather to help with this group...',
  },

  /** The modal behind the account menu's Report a problem and Ctrl+Shift+I. */
  issueReporter: {
    title: 'Report an issue',
    types: {
      bug: 'Bug',
      enhancement: 'Enhancement',
      docs: 'Docs',
      question: 'Question',
    },
    placeholder: 'What happened, or what would you like to see?',
    publicNotice:
      "Reports are filed as public GitHub issues that anyone can read. Don't include personal details such as names, email addresses or passwords. Your account is not attached.",
    send: 'Send',
    sending: 'Sending…',
    filed: 'Thanks — your report was filed.',
    viewIssue: 'View issue',
    unreachable: 'Could not reach the server.',
  },

  /**
   * The phone's Home, "Today" (Tiles & Today): what is due, what happened
   * today, and the Member's Pins.
   */
  today: {
    /** Under the Group's name: the date, then how many Members. */
    date: '{weekday} {day} {month}',
    members: { one: '{count} member', other: '{count} members' },
    heading: 'Today',
    anytime: 'Anytime today',
    pinned: 'Pinned',
    /** The Now card, shown only while a task is past its due date. */
    overdue: {
      caption: 'Overdue tasks',
      inList: 'in {list}',
      acrossLists: 'across {count} lists',
      openList: 'Open {list}',
      openTasks: 'Open tasks',
    },
    /** The Today rail: a past entry's line, and where now is. */
    entry: '{summary} \u00b7 {child}',
    now: 'Now \u00b7 {time}',
    open: 'Open',
    unpin: 'Unpin',
  },

  home: {
    recentActivity: 'Recent activity',
    /** Under the five newest entries, when the stream holds more. */
    seeAll: 'See all',
    showFewer: 'Show fewer',
    nothingYet: 'Nothing has happened in {group} yet.',
    nothingYetShared:
      'Whatever anybody here adds appears in this list, with their name on it.',
  },

  /**
   * The sentence Home builds around an activity entry, and when it happened.
   *
   * Verbs and connectors are two lists rather than one record of pairs because
   * a recipe entry has no connector at all — which kinds take one is a fact
   * about the data, settled in `groupActivity.ts`, not something a translator
   * should have to invent a word for.
   */
  activity: {
    unknownActor: 'Someone',
    verbs: {
      recipe: 'added the recipe',
      task: 'added the task',
      babyEvent: 'logged',
      tasting: 'rated',
    },
    connectors: {
      task: 'to',
      babyEvent: 'for',
    },
    justNow: 'Just now',
    minutesAgo: { one: '{count} minute ago', other: '{count} minutes ago' },
    hoursAgo: { one: '{count} hour ago', other: '{count} hours ago' },
    yesterday: 'Yesterday',
    daysAgo: '{count} days ago',
  },
}
