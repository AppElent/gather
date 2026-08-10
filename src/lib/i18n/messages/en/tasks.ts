/**
 * The Tasks module's own words.
 *
 * A task's title, a list's name, and the labels a household invents are
 * content. So is anything mirrored from Notion or Todoist — those rows belong
 * to the other app, and gather only reads them.
 */
export const tasks = {
  page: {
    subtitle:
      'Shared lists — local ones live here, linked ones mirror Notion or Todoist.',
    addList: 'Add list',
    emptyTitle: 'No lists yet',
    emptyBody: 'Create a local list, or link one from Notion or Todoist.',
    emptyAction: 'Add your first list',
    deleteListTitle: 'Delete the list “{name}”?',
    deleteListBody: 'Its tasks go with it, for everyone in this group.',
    deleteListConfirm: 'Delete list',
    deleteListFailed: 'Could not delete that list.',
  },

  row: {
    toggle: 'Toggle {task}',
    openInSource: 'Open {task} in its source app',
  },

  local: {
    pill: 'Local',
    deleteList: 'Delete list {name}',
    quickAdd: 'Add a task…',
    newTaskIn: 'New task in {name}',
    addTask: 'Add task',
    showDetails: 'Add with details…',
    hideDetails: 'Hide details',
    empty: 'No tasks yet.',
    moveUp: 'Move {task} up',
    moveDown: 'Move {task} down',
    edit: 'Edit {task}',
    delete: 'Delete {task}',
  },

  external: {
    refresh: 'Refresh {name}',
    refreshing: 'Refreshing…',
    loadFailed: 'Could not load this list.',
    reconnect: 'The {provider} connection needs to be reconnected.',
    goToSettings: 'Go to group settings',
    empty: 'No open tasks in this {provider} list.',
    /** Which account and which source at it this list reads from. */
    source: '{source} · {account}',
    sourceUnknownAccount: '{source} · disconnected account',
    /** The cache is all there is at the moment, and says so. */
    stale:
      'Could not reach {provider}. These are the tasks gather last saw, and they are read-only until it answers again.',
    reconnectStale:
      'The {provider} connection for this list is disconnected. These are the tasks gather last saw, and they are read-only until it is reconnected.',
    unconfigured: 'This list is missing its provider configuration.',
    /** Why a control this Module usually offers is not on offer here. */
    readOnlyProvider: 'Tasks in this list are edited in {provider}.',
    neverSynced: 'Loading this list from {provider}…',
  },

  editor: {
    title: 'Task title',
    dueDate: 'Due date',
    priority: 'Priority',
    noPriority: 'No priority',
    p1: 'P1 — urgent',
    p2: 'P2',
    p3: 'P3',
    p4: 'P4',
    labels: 'Labels',
    labelsPlaceholder: 'Labels, comma-separated',
  },

  addList: {
    title: 'Add a list',
    local: 'Local list — created and edited here',
    mirror: '{provider} — read-only mirror',
    connectFirst: 'Connect {provider} first…',
    listName: 'List name',
    create: 'Create',
    failed: 'Something went wrong — try again.',
    pickConnection: 'Which {provider} account?',
    connectAnother: 'Connect another {provider} account…',
    pickNotion: 'Pick the Notion database to mirror:',
    pickTodoist: 'Pick the Todoist project to mirror:',
    nothingFoundNotion:
      'Nothing found — make sure the connection has access to at least one database.',
    nothingFoundTodoist:
      'Nothing found — make sure the connection has access to at least one project.',
  },

  notionMapping: {
    intro:
      'Map this database’s properties so gather knows how to read it. A status property counts as done when it is named Done, Complete, or Completed.',
    notMapped: 'Not mapped',
    titleProperty: 'Title property',
    doneProperty: 'Done property (checkbox or status)',
    dueDateProperty: 'Due date property',
    priorityProperty: 'Priority property (select named 1–4 or P1–P4)',
    labelsProperty: 'Labels property',
    create: 'Create linked list',
  },
}
