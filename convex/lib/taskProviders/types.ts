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

export interface ProviderCapabilities {
  write: boolean
  priority: boolean
  labels: boolean
}

/** Thrown when the provider rejects our token (expired/revoked). The UI
 * turns this into a "reconnect" prompt instead of a generic error. */
export class ProviderAuthError extends Error {
  constructor(provider: ExternalProviderId) {
    super(`${provider} connection is no longer valid`)
    this.name = 'ProviderAuthError'
  }
}

export interface TaskProviderAdapter {
  id: ExternalProviderId
  capabilities: ProviderCapabilities
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
}
