/**
 * Historical Module ids that may still exist in persisted Pins and phone-local
 * arrangements. This stays outside the live catalogue: compatibility history
 * and the current product change for different reasons.
 */
export function expandRetiredModuleIds(
  ids: readonly string[] | undefined,
): string[] | undefined {
  return ids?.flatMap((id) =>
    id === 'finances'
      ? ['recurring-costs', 'shared-costs', 'savings-goals']
      : [id],
  )
}
