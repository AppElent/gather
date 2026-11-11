// Which feature ships on which platform, and why (docs/adr/0042, the parity
// ADR; the platform-parity standard, AppElent/developer-tools#63). Pure data:
// no imports, so it runs on web, Worker, Convex, and Hermes.
// scripts/feature-manifest.test.ts checks it against both route trees in CI.
// FU-n placeholders name the follow-up issue that moves a feature.

export type Platform = 'web' | 'mobile'

/**
 * parity: on both platforms. exclusive: on one platform by design.
 * pending-port: meant for both platforms, on one for now.
 */
export type FeatureStatus = 'parity' | 'exclusive' | 'pending-port'

/**
 * floor: required on both platforms (sign-in, account, export, deletion, ...).
 * share-target: someone without the app may open it from a link.
 * product: everything else.
 */
export type FeatureKind = 'floor' | 'share-target' | 'product'

export interface Feature {
  /** Stable kebab-case id. */
  readonly id: string
  readonly kind: FeatureKind
  readonly status: FeatureStatus
  /** Platforms that ship the feature today. Empty only for a pending-port feature that exists nowhere yet. */
  readonly platforms: readonly Platform[]
  /** Why the feature is not on both platforms. Required unless status is "parity". */
  readonly reason?: string
  /** Web layout. Defaults to "responsive"; "large-screen" needs layoutReason. */
  readonly layout?: 'responsive' | 'large-screen'
  readonly layoutReason?: string
  /**
   * Route files owned by the feature, relative to each platform's route root
   * and without extension. `*` matches within one path segment, `**` across
   * segments: "recipes/**", "(app)/(tabs)/settings/*".
   */
  readonly routes: {
    readonly web?: readonly string[]
    readonly mobile?: readonly string[]
  }
}

export const defineFeatures = <const T extends readonly Feature[]>(
  features: T,
): T => features

const ADR =
  'docs/adr/0042-the-phone-leads-and-the-web-is-where-a-household-is-managed.md'
const ACCOUNT = '(app)/(tabs)/settings/account'

export const FEATURES = defineFeatures([
  // -- Floor -----------------------------------------------------------------
  {
    id: 'sign-in',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['sign-in', 'sign-up', 'forgot-password'],
      mobile: ['(auth)/**'],
    },
  },
  {
    id: 'account',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    // Name and password on both; the email address is read-only on both.
    routes: {
      web: ['_app/account'],
      mobile: [
        `${ACCOUNT}/index`,
        `${ACCOUNT}/name`,
        `${ACCOUNT}/password`,
        `${ACCOUNT}/email`,
      ],
    },
  },
  {
    id: 'signed-in-devices',
    kind: 'floor',
    status: 'pending-port',
    platforms: ['mobile'],
    reason:
      'Only the phone lists the sessions signed in to the account and signs one out. The web gets it in FU-4.',
    routes: { mobile: [`${ACCOUNT}/devices`] },
  },
  {
    id: 'data-export',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    // One server registry (convex/lib/dataExport.ts, keyed by every table) and
    // one collector (@gather/core/data-export) serve both clients.
    routes: { web: ['_app/account'], mobile: [`${ACCOUNT}/export`] },
  },
  {
    id: 'account-deletion',
    kind: 'floor',
    status: 'pending-port',
    platforms: ['mobile'],
    reason:
      'ADR-0032 put deletion in the app for App Store 5.1.1(v); the web has no way to start it. The web gets the same cascade in FU-1.',
    routes: { mobile: [`${ACCOUNT}/delete`] },
  },
  {
    id: 'language',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/settings'],
      mobile: ['(app)/(tabs)/settings/language'],
    },
  },
  {
    id: 'theme',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/settings'],
      mobile: ['(app)/(tabs)/settings/appearance'],
    },
  },
  {
    // The phone's Settings links to the web page (PRIVACY_STATEMENT_URL).
    id: 'privacy',
    kind: 'floor',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: { web: ['privacy'] },
  },
  {
    id: 'group-leave',
    kind: 'floor',
    status: 'pending-port',
    platforms: ['web'],
    reason:
      'Leaving a Group is account management. Only the web offers it (Group settings); on the phone the only way out of a household is deleting the account. FU-2.',
    routes: { web: ['_app/group-settings'] },
  },

  // -- Share targets ---------------------------------------------------------
  {
    // An invite is a Group's invite code (ADR-0006). Someone without the app
    // signs up on the web and enters it on /groups.
    id: 'group-join',
    kind: 'share-target',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: { web: ['_app/groups'], mobile: ['(app)/(tabs)/settings/groups'] },
  },
  {
    id: 'group-invite',
    kind: 'share-target',
    status: 'pending-port',
    platforms: ['web'],
    reason:
      'Any Member may invite (ADR-0006), but only the web shows the invite code (groups.inviteCode), so nobody can invite from the phone. FU-2.',
    routes: { web: ['_app/group-settings'] },
  },

  // -- Shell -----------------------------------------------------------------
  {
    id: 'home',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/index', '_app/home'],
      mobile: ['(app)/(tabs)/home/index'],
    },
  },
  {
    id: 'all-modules',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    // The arrangement is kept per client (ADR-0033).
    routes: {
      web: ['_app/all'],
      mobile: ['(app)/(tabs)/all/index', '(app)/(tabs)/all/[moduleId]'],
    },
  },
  {
    id: 'settings',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/settings'],
      mobile: ['(app)/(tabs)/settings/index'],
    },
  },
  {
    id: 'groups',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    // Your Groups: list, switch, create, delete.
    routes: { web: ['_app/groups'], mobile: ['(app)/(tabs)/settings/groups'] },
  },
  {
    id: 'group-management',
    kind: 'product',
    status: 'exclusive',
    platforms: ['web'],
    reason: `Renaming a Group, its appearance, Members and roles are managed at a desk (${ADR}).`,
    routes: { web: ['_app/group-settings'] },
  },
  {
    id: 'integrations',
    kind: 'product',
    status: 'exclusive',
    platforms: ['web'],
    reason: `Connecting and disconnecting a Group's external services (Group settings, Connections) is a web goal (${ADR}). The phone shows the linked task lists.`,
    routes: { web: ['_app/integrations.callback', '_app/group-settings'] },
  },
  {
    id: 'about',
    kind: 'product',
    status: 'exclusive',
    platforms: ['web'],
    reason:
      "The public page for visitors who do not have Gather yet. The phone's front door is its welcome screen (sign-in).",
    routes: { web: ['about'] },
  },
  {
    id: 'retired-urls',
    kind: 'product',
    status: 'exclusive',
    platforms: ['web'],
    reason:
      'Unknown and retired URLs, old /g/<slug>/… ones included, answer not-found (ADR-0031).',
    routes: { web: ['_app/$'] },
  },
  {
    id: 'search',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `The Search tab is a phone destination (ADR-0018) for finding something mid-day (${ADR}).`,
    routes: { mobile: ['(app)/(tabs)/search/**'] },
  },
  {
    id: 'quick-add',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `The Add tab is the phone's capture verb (ADR-0018, ${ADR}).`,
    routes: { mobile: ['(app)/(tabs)/add'] },
  },
  {
    id: 'drop',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Receives the phone's share sheet (docs/contracts/drop.md); capture is the phone's goal (${ADR}).`,
    routes: { mobile: ['(app)/drop/**'] },
  },
  {
    id: 'legacy-group-links',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason:
      'Consumes old gather://g/<slug>/… links (ADR-0015, superseded by ADR-0031). Nothing produces them any more and the web 404s /g/ by ADR-0031, so FU-3 retires the handler.',
    routes: { mobile: ['g/[groupSlug]/[...rest]', '(app)/deep-link'] },
  },
  {
    id: 'labs',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Prototypes of phone designs, reached through Settings > Labs (${ADR}).`,
    routes: {
      mobile: [
        '(app)/(tabs)/settings/labs/index',
        '(app)/(tabs)/settings/labs/calendar',
      ],
    },
  },
  {
    id: 'finance-labs',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Unfinished money tools (houses and mortgages, portfolio, net worth) kept in the phone's Labs while their designs settle (${ADR}).`,
    routes: { mobile: ['(app)/(tabs)/settings/labs/finance/**'] },
  },

  // -- Modules on both -------------------------------------------------------
  {
    id: 'recipes',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/recipes/**'],
      mobile: ['(app)/(tabs)/all/recipes/**', '(app)/(tabs)/search/recipes/**'],
    },
  },
  {
    id: 'tasks',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/tasks'],
      mobile: ['(app)/(tabs)/all/tasks/**', '(app)/(tabs)/search/tasks/**'],
    },
  },
  {
    id: 'baby-log',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/baby/**'],
      mobile: [
        '(app)/(tabs)/all/baby-log/**',
        '(app)/(tabs)/settings/baby-log/**',
      ],
    },
  },
  {
    id: 'tasting',
    kind: 'product',
    status: 'parity',
    platforms: ['web', 'mobile'],
    routes: {
      web: ['_app/wines/**', '_app/cheeses/**', '_app/beers/**'],
      mobile: ['(app)/(tabs)/all/tasting/**', '(app)/(tabs)/search/tasting/**'],
    },
  },

  // -- Phone Modules ---------------------------------------------------------
  {
    id: 'calendar',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: {
      mobile: [
        '(app)/(tabs)/all/calendar/**',
        '(app)/(tabs)/search/calendar/**',
      ],
    },
  },
  {
    id: 'notes',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: {
      mobile: ['(app)/(tabs)/all/notes/**', '(app)/(tabs)/search/notes/**'],
    },
  },
  {
    id: 'groceries',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/groceries/**'] },
  },
  {
    id: 'pantry',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/pantry/**'] },
  },
  {
    id: 'meal-planner',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/meal-planner/**'] },
  },
  {
    id: 'recurring-costs',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/recurring-costs/**'] },
  },
  {
    id: 'shared-costs',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/shared-costs/**'] },
  },
  {
    id: 'savings-goals',
    kind: 'product',
    status: 'exclusive',
    platforms: ['mobile'],
    reason: `Daily capture is the phone's goal (${ADR}). The web route is a placeholder (planned-web-modules).`,
    routes: { mobile: ['(app)/(tabs)/all/savings-goals/**'] },
  },
  {
    // ModulePlaceholder pages: the Module's name, a "planned" pill, nothing else.
    id: 'planned-web-modules',
    kind: 'product',
    status: 'exclusive',
    platforms: ['web'],
    reason: `Placeholders for phone Modules, pending a decision per Module to build it on the web or remove the page (FU-5, ${ADR}).`,
    routes: {
      web: [
        '_app/calendar',
        '_app/notes',
        '_app/groceries',
        '_app/pantry',
        '_app/meal-planner',
        '_app/recurring-costs',
        '_app/shared-costs',
        '_app/savings-goals',
      ],
    },
  },
])
