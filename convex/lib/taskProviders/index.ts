import type { ExternalProviderId, TaskProviderId } from '@gather/core/domain'
import { notionAdapter } from './notion'
import { todoistAdapter } from './todoist'
import type { TaskProviderAdapter } from './types'

const adapters: Record<ExternalProviderId, TaskProviderAdapter> = {
  notion: notionAdapter,
  todoist: todoistAdapter,
}

export function getAdapter(id: ExternalProviderId): TaskProviderAdapter {
  return adapters[id]
}

/**
 * Whether Gather may write to a list on this provider. A local list always can;
 * an external one answers with its provider's capability, and Gather never
 * emulates a write the provider will not take (ADR-0021).
 */
export function canWriteToList(provider: TaskProviderId): boolean {
  return provider === 'local' || adapters[provider].capabilities.write
}
