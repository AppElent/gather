import type { ExternalProviderId } from '@gather/core/domain'
import type { Id } from '../../_generated/dataModel'

export interface UnifiedTask {
  externalId: string
  title: string
  done: boolean
  dueDate?: string // ISO date, YYYY-MM-DD
  priority?: 1 | 2 | 3 | 4 // 1 = most urgent (Todoist "p1")
  labels?: string[]
  url?: string // link-out to the item in its source app (external only)
  /**
   * How the item repeats, in the provider's own words ("every week"), for a
   * linked list's Repeat row (APP-303). Gather cannot write it back.
   */
  repeatText?: string
  /**
   * The `externalId` of the item this one is a subtask of (APP-304): Todoist's
   * `parent_id`, Notion's sub-item relation. Absent on a top-level item.
   */
  parentExternalId?: string
  /** The provider's id of the person responsible; never sent to a client. */
  responsibleId?: string
  /** The Member of the list's Group that person is (APP-405). */
  assigneeId?: Id<'users'>
  /**
   * The person responsible when no Member of the Group is known to be them;
   * empty when their name is not known either.
   */
  assigneeName?: string
}

/** Someone a source's tasks can be given to, as the provider knows them. */
export interface ProviderPerson {
  id: string
  name: string
  email: string
  /** Whether it is the account the connection belongs to. */
  self: boolean
}

/** Who a source's tasks can be given to; nobody unless it is shared. */
export interface SourcePeople {
  shared: boolean
  people: ProviderPerson[]
}

export interface ProviderSource {
  id: string
  name: string
}

export interface SourceProperty {
  id: string
  name: string
  type: string
}

export interface PropertyMapping {
  title: string
  done: string
  dueDate?: string
  priority?: string
  labels?: string
}

export interface SourceConfig {
  sourceId: string
  propertyMapping?: PropertyMapping
}

export interface ProviderCapabilities {
  write: boolean
}

/** Thrown when the provider rejects our token (expired/revoked). The UI
 * turns this into a "reconnect" prompt instead of a generic error. */
export class ProviderAuthError extends Error {
  constructor(provider: ExternalProviderId) {
    super(`${provider} connection is no longer valid`)
    this.name = 'ProviderAuthError'
  }
}

/** The asked-for task is not (or no longer) in the list's project. */
export class ProviderTaskNotFoundError extends Error {
  constructor(provider: ExternalProviderId) {
    super(`${provider} has no such task in this list`)
    this.name = 'ProviderTaskNotFoundError'
  }
}

/** What a task can be created with or changed to; null clears a field. */
export interface TaskFieldChanges {
  title?: string
  dueDate?: string | null
  priority?: 1 | 2 | 3 | 4 | null
  labels?: string[]
}

/** A change to a task that is there: also whose it is, or nobody's with null. */
export interface TaskUpdate extends TaskFieldChanges {
  responsibleId?: string | null
}

export interface NewProviderTask extends TaskFieldChanges {
  title: string
  parentId?: string
  /** The same key makes one task, however often it is sent. */
  requestKey?: string
}

/** What a provider answered to an accepted write. */
export interface WriteOutcome {
  /** Tasks as the provider has them now; rows it did not answer for are absent. */
  tasks: UnifiedTask[]
  /**
   * The write was accepted, but the list has to be read again to know all of
   * what it did (a recurring task's next date, or a failed read-back).
   */
  refresh: boolean
}

/**
 * A provider's write calls. Every one is confined to `config`'s source: a task
 * or parent elsewhere in the connected account is refused as not found.
 * A call resolves only once the provider accepted the change.
 */
export interface TaskProviderWriter {
  createTask(
    accessToken: string,
    config: SourceConfig,
    task: NewProviderTask,
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
  updateTask(
    accessToken: string,
    config: SourceConfig,
    taskId: string,
    changes: TaskUpdate,
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
  /**
   * `withSubtasks` completes everything open under a recurring task with it.
   * Retried with the same `requestKey`, it moves each recurring subtask on once.
   */
  closeTask(
    accessToken: string,
    config: SourceConfig,
    taskId: string,
    options: { withSubtasks: boolean; requestKey?: string },
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
  reopenTask(
    accessToken: string,
    config: SourceConfig,
    taskId: string,
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
  /** Under another task, or out to the top of the list with null. */
  moveTask(
    accessToken: string,
    config: SourceConfig,
    taskId: string,
    parentId: string | null,
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
  /**
   * Into another source of the same connection, with its subtasks, at the top
   * of it: out of its parent and its section (APP-821).
   */
  moveToSource(
    accessToken: string,
    config: SourceConfig,
    taskId: string,
    target: SourceConfig,
    fetchImpl?: typeof fetch,
  ): Promise<WriteOutcome>
}

export interface TaskProviderAdapter {
  id: ExternalProviderId
  capabilities: ProviderCapabilities
  /** Present exactly when `capabilities.write`. */
  writer?: TaskProviderWriter
  listAvailableSources(
    accessToken: string,
    fetchImpl?: typeof fetch,
  ): Promise<ProviderSource[]>
  getSourceSchema(
    accessToken: string,
    sourceId: string,
    fetchImpl?: typeof fetch,
  ): Promise<SourceProperty[]>
  fetchTasks(
    accessToken: string,
    config: SourceConfig,
    fetchImpl?: typeof fetch,
  ): Promise<UnifiedTask[]>
  /** Absent when the provider has nobody to give a task to (Notion). */
  fetchPeople?(
    accessToken: string,
    config: SourceConfig,
    fetchImpl?: typeof fetch,
  ): Promise<SourcePeople>
}
