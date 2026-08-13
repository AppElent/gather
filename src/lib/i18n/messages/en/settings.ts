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

  nutritionTargets: {
    title: 'Daily targets',
    description:
      'What you are aiming for in a day. Your food diary shows the day against these; leave one blank and it is simply not tracked.',
    save: 'Save targets',
    saveFailed: 'Could not save targets',
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
    disconnectedAccount: '{account} — disconnected',
    connect: 'Connect',
    connectAnother: 'Connect another account',
    reconnect: 'Reconnect',
    opening: 'Opening…',
    disconnect: 'Disconnect',
    disconnectTitle: 'Disconnect {account} from {group}?',
    disconnectBody:
      'Lists linked to this account keep their last known tasks, read-only, until it is reconnected.',
    disconnectFailed: 'Could not disconnect {provider}.',
    startFailed: 'Could not start the connection — try again.',
  },

  group: {
    title: 'This group',
    personalNote:
      'Your personal group. It is only ever yours, so there is nothing here to share or leave.',
    sharedNote: 'Its name, the code that lets somebody in, and the way out.',
    name: 'Name',
    rename: 'Rename',
    renameFailed: 'Could not rename this group.',
    addressChanges:
      'The address changes with the name, so old links to this group stop working.',
    inviteCode: 'Invite code',
    inviteCodeNote:
      'Anyone holding this code can join from Groups — share it only with people you want in this group.',
    leave: 'Leave',
    leaveButton: 'Leave this group',
    leaveTitle: 'Leave {group}?',
    leaveBody:
      'You stop seeing everything in it. Anything you added stays with the group.',
    leaveConfirm: 'Leave group',
    leaveFailed: 'Could not leave this group.',
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
      ', such as a task on a sample list. Your own groups, your food diary and recipes you own are left alone, and your default group is put back. Not available in production.',
    load: 'Load sample data',
    loading: 'Loading…',
    remove: 'Remove sample data',
    removing: 'Removing…',
    confirmRemove:
      'Remove the sample household, including anything you added inside it? Your own groups, diary and recipes are left alone.',
    loaded:
      'Loaded {recipes} recipes, {tasks} tasks, {babyEvents} baby events and {diaryEntries} diary entries into “{group}”.',
    removed: 'Removed {deleted} sample rows.',
    removedWithOrphans: {
      one: 'Removed {deleted} sample rows and {count} row added inside them.',
      other:
        'Removed {deleted} sample rows and {count} rows added inside them.',
    },
    failed: 'Could not run the seed — check the logs.',
  },
}
