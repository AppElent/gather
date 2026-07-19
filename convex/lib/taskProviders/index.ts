import { notionAdapter } from './notion'
import { todoistAdapter } from './todoist'
import type { ExternalProviderId, TaskProviderAdapter } from './types'

const adapters: Record<ExternalProviderId, TaskProviderAdapter> = {
  notion: notionAdapter,
  todoist: todoistAdapter,
}

/** Future providers (e.g. Outlook) register here — one new module, one line. */
export function getAdapter(id: ExternalProviderId): TaskProviderAdapter {
  return adapters[id]
}
