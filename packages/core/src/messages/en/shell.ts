/**
 * The app around the app: navigation, the topbar, the Group switcher, the
 * pages that are not a Module, and the words Home puts around an activity
 * entry.
 *
 * Grouped by the surface that renders each one, and named for what the string
 * means rather than where it sits — a key called after its position stops being
 * true the first time the layout moves.
 */
export const shell = {
  topbar: {
    openNavigation: 'Open navigation',
    jumpTo: 'Jump to',
    askGather: 'Ask Gather',
    reportIssue: 'Report an issue',
    switchLanguage: 'Switch to {language}',
  },

  sidebar: {
    label: 'Gather navigation',
    primary: 'Primary',
    footer: 'Settings and groups',
    noGroup: 'Pick a group to see its modules.',
  },

  dock: {
    label: 'Mobile navigation',
  },

  drawer: {
    label: 'Navigation',
    close: 'Close navigation',
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
    none: 'No group',
    elsewhere: 'Go back to it',
    personal: 'Your own group',
    shared: 'Shared group',
    pick: 'Pick a group',
    personalPill: 'Personal',
    manage: 'Manage groups',
  },

  /** The marks a Module carries wherever it is listed. */
  marks: {
    soon: 'Soon',
    onlyYou: 'Only you',
    onlyYouExplained: 'Only you can see this. It is the same in every group.',
  },

  /** Navigation item names that belong to no Module. */
  nav: {
    home: 'Home',
    all: 'All',
    groups: 'Groups',
    settings: 'Settings',
    groupSettings: 'Group settings',
  },

  /** What the topbar says it is showing you, per surface. */
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

  /** The gate in front of every `/g/<slug>` page. */
  groupGate: {
    unknownTitle: 'No such group',
    unknownBody:
      'Nothing here is called “{slug}”. Check the link, or pick a group from the sidebar.',
    forbiddenTitle: 'This group is not yours',
    forbiddenBody:
      'You are not a member of it. Ask an admin of the group for an invite.',
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
    subtitle:
      'Gather keeps shared recipes, plans, lists, tasks, notes, and tasting logs in one place, for the people who share a household.',
    modules:
      'Recipes and Nutrition are live today, and the surrounding modules are staged so a group can grow into meal planning, groceries, pantry tracking, finances, bills, tasks, calendar, notes, cheeses, and wines without changing products.',
    pins: "Every module is available in every group. You pin the ones you use to your own navigation, and the rest stay one click away — your choices are yours alone and never move anybody else's.",
  },

  publicFrame: {
    brand: 'Gather',
    tagline: 'Household plans, shared',
  },

  /** The panel the topbar's Ask Gather button opens. */
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

  /** The modal behind the topbar's bug button and Ctrl+Shift+I. */
  issueReporter: {
    title: 'Report an issue',
    types: {
      bug: 'Bug',
      enhancement: 'Enhancement',
      docs: 'Docs',
      question: 'Question',
    },
    placeholder: 'What happened, or what would you like to see?',
    send: 'Send',
    sending: 'Sending…',
    filed: 'Thanks — your report was filed.',
    viewIssue: 'View issue',
    unreachable: 'Could not reach the server.',
  },

  home: {
    personalSubtitle: 'Your own group. Anything kept here is private to you.',
    sharedSubtitle: 'What everyone in this group has been up to.',
    whoIsHere: 'Who is here',
    admin: 'Admin',
    /**
     * Split around the link it contains rather than assembled from one string,
     * so a translation can put the sentence in its own order without either
     * half having to carry markup.
     */
    personalNote: {
      before:
        '{group} is yours alone — nothing kept here is visible to anybody else. To share something with other people, start a group with them in',
      link: 'Groups',
      after: '.',
    },
    sharedNote: {
      before:
        'Everyone here sees everything in {group}. To invite somebody else, or to leave, go to',
      link: 'Groups',
      after: '.',
    },
    recentActivity: 'Recent activity',
    nothingYet: 'Nothing has happened in {group} yet.',
    nothingYetPersonal:
      'Whatever you add here appears in this list, and only you will ever see it.',
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
