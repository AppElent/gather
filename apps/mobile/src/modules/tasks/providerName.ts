const PROVIDER_NAMES: Record<string, string> = {
  local: 'Gather',
  notion: 'Notion',
  todoist: 'Todoist',
}

/** A brand name, as the provider writes it. Not translated. */
export function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider
}
