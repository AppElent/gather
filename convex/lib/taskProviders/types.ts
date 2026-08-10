export type ExternalProviderId = 'notion' | 'todoist'
export type ProviderId = 'local' | ExternalProviderId

export interface UnifiedTask {
  externalId: string
  title: string
  done: boolean
  dueDate?: string // ISO date, YYYY-MM-DD
  priority?: 1 | 2 | 3 | 4 // 1 = most urgent (Todoist "p1")
  labels?: string[]
  url?: string // link-out to the item in its source app (external only)
}

export interface ProviderSource {
  id: string
  name: string
}

/**
 * Which account at the provider a token actually speaks for.
 *
 * A Group may connect the same provider more than once — a shared household
 * Todoist and somebody's own, two Notion workspaces — so "the Group's Todoist"
 * is no longer an identity. `externalAccountId` is: it is what tells a second
 * connection apart from a re-authorisation of the first, and so what stops
 * reconnecting from quietly stacking up duplicate rows.
 *
 * It comes from the provider rather than from the token, because a token is
 * rotated and the account behind it is not.
 */
export interface ProviderAccount {
  externalAccountId: string
  accountLabel: string
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

/**
 * What a Backend can actually do — read by the Tasks Module in place of the
 * provider's name (ADR-0014).
 *
 * The Module never asks "is this Todoist"; it asks "may I delete here". That is
 * what keeps provider knowledge behind the adapters, and it is the only shape
 * that can express the case a provider name cannot: the same provider differing
 * per source, like a Notion database with no date property.
 *
 * An unsupported operation is offered disabled and explained. It is never
 * carried out against the cache alone — a change the provider did not accept
 * did not happen.
 */
export interface TaskCapabilities {
  create: boolean
  edit: boolean
  complete: boolean
  delete: boolean
  /** Whether the reader may choose the order, or the provider owns it. */
  reorder: boolean
  subtasks: boolean
  priority: boolean
  labels: boolean
  dueDate: boolean
  /** Deepest nesting the Backend accepts. Absent means no limit of its own. */
  maxDepth?: number
}

/** Local lists are this app and nothing else, so they can do everything. */
export const LOCAL_CAPABILITIES: TaskCapabilities = {
  create: true,
  edit: true,
  complete: true,
  delete: true,
  reorder: true,
  subtasks: true,
  priority: true,
  labels: true,
  dueDate: true,
}

/** A Backend that can be read and nothing else. */
export const READ_ONLY_CAPABILITIES: TaskCapabilities = {
  create: false,
  edit: false,
  complete: false,
  delete: false,
  reorder: false,
  subtasks: false,
  priority: true,
  labels: true,
  dueDate: true,
}

/**
 * A write, as the common Task record expresses it.
 *
 * `null` clears a field and `undefined` leaves it alone — the same distinction
 * the local mutations make, and one an external write needs even more, because
 * "leave it alone" there means "do not mention it to the provider at all".
 */
export interface TaskInput {
  title?: string
  dueDate?: string | null
  priority?: 1 | 2 | 3 | 4 | null
  labels?: string[] | null
}

/** Thrown when the provider rejects our token (expired/revoked). The UI
 * turns this into a "reconnect" prompt instead of a generic error. */
export class ProviderAuthError extends Error {
  constructor(provider: ExternalProviderId) {
    super(`${provider} connection is no longer valid`)
    this.name = 'ProviderAuthError'
  }
}

/**
 * The provider is asking us to slow down. Distinct from a fault because the
 * answer is different: wait and try the same thing again, rather than assume
 * anything is wrong with what was sent.
 */
export class ProviderRateLimitError extends Error {
  constructor(
    provider: ExternalProviderId,
    /** Seconds the provider asked us to wait, when it said. */
    readonly retryAfterSeconds?: number,
  ) {
    super(`${provider} is rate limiting this connection`)
    this.name = 'ProviderRateLimitError'
  }
}

/**
 * This Backend cannot do this at all — a Notion write, a reorder in Todoist.
 *
 * Reaching this is a bug rather than a state a reader can get into: the
 * capability list is what the UI offers from, so an unsupported operation
 * should never be requested. It throws rather than falling back to a local
 * write, because a local write the provider never accepted is exactly the lie
 * ADR-0014 exists to prevent.
 */
export class ProviderUnsupportedError extends Error {
  constructor(provider: ExternalProviderId, operation: string) {
    super(`${provider} does not support ${operation}`)
    this.name = 'ProviderUnsupportedError'
  }
}

/** The provider refused this particular request — bad input, no permission. */
export class ProviderRequestError extends Error {
  constructor(
    provider: ExternalProviderId,
    readonly status: number,
  ) {
    super(`${provider} refused the request (${status})`)
    this.name = 'ProviderRequestError'
  }
}

export interface TaskProviderAdapter {
  id: ExternalProviderId
  /** The adapter's baseline. Narrowed per source by `capabilitiesForSource`. */
  capabilities: TaskCapabilities
  /**
   * The baseline narrowed by what one source itself allows — a Notion database
   * with no date property has no due dates, whatever Notion supports.
   */
  capabilitiesForSource?(config: SourceConfig): TaskCapabilities
  /**
   * Who this token is, at the provider. Asked once, when a connection is
   * stored, so that a Group's connections can be told apart from each other.
   */
  getAccountIdentity(
    accessToken: string,
    fetchImpl?: typeof fetch,
  ): Promise<ProviderAccount>
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

  /**
   * The writes, present only on a Backend that has them. Each returns the task
   * as the provider now holds it, so the cache is updated from the provider's
   * answer rather than from what we hoped it would do (ADR-0013) — and a
   * provider that quietly normalised something is believed.
   *
   * Absent here means unsupported, which the capability list already said.
   */
  createTask?(
    accessToken: string,
    config: SourceConfig,
    input: TaskInput & { title: string },
    fetchImpl?: typeof fetch,
  ): Promise<UnifiedTask>
  updateTask?(
    accessToken: string,
    config: SourceConfig,
    externalId: string,
    input: TaskInput,
    fetchImpl?: typeof fetch,
  ): Promise<UnifiedTask>
  setDone?(
    accessToken: string,
    config: SourceConfig,
    externalId: string,
    done: boolean,
    fetchImpl?: typeof fetch,
  ): Promise<void>
  deleteTask?(
    accessToken: string,
    config: SourceConfig,
    externalId: string,
    fetchImpl?: typeof fetch,
  ): Promise<void>
}
