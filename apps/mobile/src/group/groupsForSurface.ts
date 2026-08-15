export function groupsForSurface<T>(
  current: T[] | undefined,
  retained: T[] | undefined,
): T[] | undefined {
  return current ?? retained
}
