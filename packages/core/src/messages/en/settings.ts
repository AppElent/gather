export const settings = {
  title: 'Settings',

  language: {
    title: 'Language',
    description:
      'Which language Gather itself is in. What you and your groups have written stays in the language you wrote it.',
    /** The name of each language in that language, as a speaker of it writes it. */
    names: {
      en: 'English',
      nl: 'Nederlands',
    },
  },

  appearance: {
    title: 'Appearance',
    description: 'Choose how Gather looks. Auto follows your system setting.',
    /** Keyed by the web's stored theme mode (`src/lib/auth/theme.ts`). */
    modes: {
      light: 'Light',
      auto: 'Auto',
      dark: 'Dark',
    },
  },

  /**
   * "Signed-in devices" on the web's Account page. The phone's Devices screen
   * says the same (`apps/mobile/src/i18n/messages/en.ts`, `account.sessions`).
   * The session you are holding is not revocable from itself: that is Sign out.
   */
  signedInDevices: {
    title: 'Signed-in devices',
    description: 'Where you are signed in.',
    thisDevice: 'This device',
    lastActive: 'Last active {when}',
    unknownDevice: 'Unknown device',
    signOutOf: 'Sign out',
    revokeTitle: 'Sign out of {device}?',
    revokeBody: 'That device has to sign in again.',
    failed: 'Could not load or change your signed-in devices. Try again.',
  },

  /**
   * "Export your data" — on the web's Account page and the phone's Account
   * screen. What it holds back is stated before the button, because it is
   * the answer to "is my partner's stuff in my file?"
   */
  dataExport: {
    title: 'Export your data',
    description:
      'One JSON file with your account and everything in each group you are a member of.',
    leftOut:
      'Other members appear by name only: their own records and choices stay theirs. Connection tokens and invite codes are left out.',
    photos:
      'Photos are included as links, not as files. Anyone you give the file to can open those links.',
    action: 'Export',
    busy: 'Exporting… {done} of {total}',
    failed: 'Could not export your data. Try again.',
    unavailable: 'This device has nowhere to share the file to.',
  },

  /**
   * "Delete account": the phone's Delete account screen and the web Account
   * page's Danger zone. What it destroys is said *before* the confirmation
   * rather than inside it: a dialog is the wrong place to read a list of
   * households.
   */
  deleteAccount: {
    title: 'Delete account',
    /** The web's section heading on Account. */
    dangerZone: 'Danger zone',
    lead: 'This cannot be undone.',
    goesHeading: 'Deleted',
    goesBody:
      'You are the only member of these Groups, so they go, and everything in them goes with them.',
    keptHeading: 'Left, not deleted',
    keptBody:
      'These Groups have other members. You stop seeing them, and anything you added stays with the household.',
    noGroups: 'You are not in any Groups.',
    /**
     * The choice (APP-392): Gather shares its login with the other AppElent
     * apps, so deleting it is not Gather's alone. Gather's data comes first;
     * the whole account names every app it takes with it.
     */
    choiceIntro:
      'You sign in to Gather with your AppElent login, which Foundry, Fairway and Arcade Club use too. Choose what to delete.',
    dataOnly: {
      title: 'Delete Gather data only',
      body: 'Your Groups are deleted or left as shown above. Your AppElent login stays, so Foundry, Fairway and Arcade Club keep working. Signing in to Gather again later starts a new, empty account.',
      submit: 'Delete Gather data',
      confirmTitle: 'Delete Gather data for {email}?',
      confirmBody:
        'Everything only you could see in Gather is deleted for good. Your AppElent login stays.',
      /** Said once the purge has started and Gather has signed out. */
      doneTitle: 'Your Gather data is deleted',
      doneBody:
        'You are signed out of Gather on this device. Your AppElent login still works in Foundry, Fairway and Arcade Club.',
      failed: 'Your Gather data could not be deleted. Nothing was deleted.',
    },
    wholeAccount: {
      title: 'Delete my whole AppElent account',
      body: 'Also deletes your AppElent login, and with it your data in Gather, Foundry, Fairway and Arcade Club. You can no longer sign in to any of them.',
      submit: 'Delete my AppElent account',
      confirmTitle: 'Delete the AppElent account {email}?',
      confirmBody:
        'Your login and your data in Gather, Foundry, Fairway and Arcade Club are deleted for good.',
    },
    /** The web asks for this word to be typed before the confirm button works. */
    confirmPhrase: 'DELETE',
    confirmPhraseLabel: 'Type {phrase} to confirm',
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
      'This account cannot be deleted here. Please contact support.',
    /**
     * The web asks Clerk for a recent sign-in before anything is deleted; Clerk
     * deletes a login only within a few minutes of one.
     */
    signInCheckFailed:
      'Your sign-in could not be confirmed, so nothing was deleted. Try again.',
    accountChanged:
      'You are signed in to a different account now. Nothing was deleted.',
    /** A refusal before anything was deleted, with no reason of its own. */
    failed: 'Your account could not be deleted. Nothing was deleted.',
    /**
     * The web's Sign in with Apple step (APP-388): before the whole account
     * goes, Apple's popup lets Gather revoke its access, as Apple requires.
     * The browser opens the popup only from a click, so it asks for one.
     */
    apple: {
      prompt:
        'You signed in with Apple. Continue with Apple once more so Apple can stop sharing your details, then your account is deleted. Nothing is deleted until then.',
      continue: 'Continue with Apple',
      waiting: 'Waiting for Apple…',
      popupBlocked:
        'Your browser blocked the Apple window, so nothing was deleted. Allow pop-ups for this site and try again.',
      appleMismatch:
        'That Apple account is not the one linked to this account, so nothing was deleted. Try again and sign in with the Apple account you use for AppElent.',
      failed:
        'The Apple window did not finish, so nothing was deleted. Try again.',
    },
  },

  groupSettings: {
    title: 'Group settings',
    description:
      'Connections to Notion and Todoist belong to a group, not to you — every member of that group can use one, and nobody outside it can. Each group keeps its own.',
    open: 'Settings',
  },

  groupPage: {
    title: '{group} settings',
    intro:
      'Settings shared by everyone in this group. Your own appearance and account settings are in Settings, and are the same in every group.',
  },

  connections: {
    title: 'Connections',
    intro:
      'Connect an external app for {group}. Every member of {group} can use it — Tasks can mirror a list from it — and nobody outside can.',
    notConnected: 'Not connected',
    connectedBy: '{account} — connected by {name}',
    connect: 'Connect',
    opening: 'Opening…',
    disconnect: 'Disconnect',
    disconnectTitle: 'Disconnect {provider} from {group}?',
    disconnectBody: 'Linked lists stop loading until it is reconnected.',
    disconnectFailed: 'Could not disconnect {provider}.',
    startFailed: 'Could not start the connection — try again.',
  },

  group: {
    title: 'This group',
    sharedNote: 'Its name, the code that lets somebody in, and the way out.',
    name: 'Name',
    rename: 'Rename',
    renameFailed: 'Could not rename this group.',
    timeZone: 'Time zone',
    timeZoneNote:
      'The day it is for everyone in this group, for example when you shop for the week. Without one, each device uses its own.',
    timeZoneUnset: 'Each device’s own ({zone} here)',
    timeZoneUseDevice: 'Use this device’s zone',
    timeZoneClear: 'Use each device’s own zone',
    timeZoneFailed: 'Could not change the time zone.',
    timeZoneAdminOnly: 'Only an admin can change it.',
    timeZoneSave: 'Save time zone',
    timeZoneEachDevice: 'Each device’s own',
    timeZoneDevice: 'This device is in {zone}.',
    timeZoneChoose: 'Choose a time zone',
    timeZoneSearch: 'Search time zones',
    timeZoneNoMatches: 'No time zone matches “{query}”.',
    // Places that read differently from their IANA name in either language.
    timeZonePlaces: {
      'Africa/Cairo': 'Cairo',
      'America/Curacao': 'Curaçao',
      'America/Mexico_City': 'Mexico City',
      'America/Sao_Paulo': 'São Paulo',
      'Asia/Baghdad': 'Baghdad',
      'Asia/Beirut': 'Beirut',
      'Asia/Hong_Kong': 'Hong Kong',
      'Asia/Jerusalem': 'Jerusalem',
      'Asia/Riyadh': 'Riyadh',
      'Asia/Tehran': 'Tehran',
      'Asia/Tokyo': 'Tokyo',
      'Asia/Yerevan': 'Yerevan',
      'Atlantic/Azores': 'Azores',
      'Atlantic/Canary': 'Canary Islands',
      'Atlantic/Cape_Verde': 'Cape Verde',
      'Atlantic/Faroe': 'Faroe Islands',
      'Atlantic/Reykjavik': 'Reykjavík',
      'Europe/Athens': 'Athens',
      'Europe/Belgrade': 'Belgrade',
      'Europe/Berlin': 'Berlin',
      'Europe/Brussels': 'Brussels',
      'Europe/Bucharest': 'Bucharest',
      'Europe/Budapest': 'Budapest',
      'Europe/Copenhagen': 'Copenhagen',
      'Europe/Istanbul': 'Istanbul',
      'Europe/Lisbon': 'Lisbon',
      'Europe/London': 'London',
      'Europe/Luxembourg': 'Luxembourg',
      'Europe/Moscow': 'Moscow',
      'Europe/Paris': 'Paris',
      'Europe/Prague': 'Prague',
      'Europe/Vatican': 'Vatican City',
      'Europe/Vienna': 'Vienna',
      'Europe/Warsaw': 'Warsaw',
      'Europe/Zurich': 'Zürich',
    },
    timeZoneRefusals: {
      'admin-only': 'Only an admin of this group can change its time zone.',
      'unknown-zone': 'Gather does not know the time zone of {zone} yet. Choose a place nearby with the same time.',
    },
    icon: 'Icon',
    iconOptions: {
      Users: 'People',
      House: 'Home',
      Heart: 'Heart',
      Utensils: 'Food',
      Wine: 'Wine',
    },
    picture: 'Group picture',
    saveAppearance: 'Save appearance',
    appearanceFailed: 'Could not save the icon and picture.',
    inviteCode: 'Invite code',
    inviteCodeNote:
      'Anyone holding this code can join from Groups — share it only with people you want in this group.',
    inviteCodeFailed: 'Could not load the invite code.',
    leave: 'Leave',
    leaveButton: 'Leave this group',
    leaveTitle: 'Leave {group}?',
    leaveBody:
      'You stop seeing everything in it. Anything you added stays with the group.',
    leaveConfirm: 'Leave group',
    leaveFailed: 'Could not leave this group.',
    lastMember:
      'You are the last member, so the group cannot be left. Delete it instead.',
    delete: 'Delete',
    deleteButton: 'Delete this group',
    deleteTitle: 'Delete {group}?',
    deleteBody:
      'Everything in it is deleted for good, along with the group itself. This cannot be undone.',
    deleteConfirm: 'Delete group',
    deleteFailed: 'Could not delete this group.',
    deleteOthersFirst: 'Only possible once everyone else has left the group.',
  },

  members: {
    title: 'Members',
    personalNote:
      'Admins can rename this group, change roles, and delete it. Everyone else can use everything in it.',
    sharedNote:
      'Admins can rename this group and change roles. Everyone here can use everything in it.',
    you: 'You',
    admin: 'Admin',
    lastAdmin: 'A group needs at least one admin',
    makeMember: 'Make member',
    makeAdmin: 'Make admin',
    roleFailed: 'Could not change that role.',
  },

  sampleData: {
    title: 'Sample data',
    descriptionBefore:
      'Rebuilds a sample household around your account, with dates anchored to today. Both actions remove the sample household completely —',
    descriptionStrong: 'including anything you added inside it',
    descriptionAfter:
      ', such as a task on a sample list. Your own groups and recipes you own are left alone, and your default group is put back. Not available in production.',
    load: 'Load sample data',
    loading: 'Loading…',
    remove: 'Remove sample data',
    removing: 'Removing…',
    confirmRemove:
      'Remove the sample household, including anything you added inside it? Your own groups and recipes are left alone.',
    loaded:
      'Loaded {recipes} recipes, {tasks} tasks and {babyEvents} baby events into “{group}”.',
    removed: 'Removed {deleted} sample rows.',
    removedWithOrphans: {
      one: 'Removed {deleted} sample rows and {count} row added inside them.',
      other:
        'Removed {deleted} sample rows and {count} rows added inside them.',
    },
    failed: 'Could not run the seed — check the logs.',
  },
}
