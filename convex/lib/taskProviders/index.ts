import { notionAdapter } from './notion'
import { todoistAdapter } from './todoist'
import {
  type ExternalProviderId,
  LOCAL_CAPABILITIES,
  type ProviderId,
  type SourceConfig,
  type TaskCapabilities,
  type TaskProviderAdapter,
} from './types'

const adapters: Record<ExternalProviderId, TaskProviderAdapter> = {
  notion: notionAdapter,
  todoist: todoistAdapter,
}

/** Future providers (e.g. Outlook) register here — one new module, one line. */
export function getAdapter(id: ExternalProviderId): TaskProviderAdapter {
  return adapters[id]
}

/**
 * What a Backend can do here, for this source.
 *
 * The one place the local Backend and the external ones answer the same
 * question, so that the Tasks Module can ask it without knowing which it is
 * holding (ADR-0014). Two levels: the adapter's baseline, narrowed by the
 * source when the source itself is narrower.
 */
export function capabilitiesFor(
  provider: ProviderId,
  config?: SourceConfig,
): TaskCapabilities {
  if (provider === 'local') return LOCAL_CAPABILITIES
  const adapter = adapters[provider]
  if (config && adapter.capabilitiesForSource) {
    return adapter.capabilitiesForSource(config)
  }
  return adapter.capabilities
}
