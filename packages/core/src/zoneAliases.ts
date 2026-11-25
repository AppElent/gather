/**
 * IANA names that older ICU builds still know under an earlier name, and
 * resolving a stored name to one this runtime accepts.
 *
 * Kept dependency-free so `civilDate`, `timeZones` and `homeToday` can all
 * share it without a cycle.
 */

/** The names ICU keeps for zones IANA has renamed. */
export const RENAMED = new Map<string, string>([
  ['Africa/Asmera', 'Africa/Asmara'],
  ['America/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
  ['America/Catamarca', 'America/Argentina/Catamarca'],
  ['America/Coral_Harbour', 'America/Atikokan'],
  ['America/Cordoba', 'America/Argentina/Cordoba'],
  ['America/Godthab', 'America/Nuuk'],
  ['America/Indianapolis', 'America/Indiana/Indianapolis'],
  ['America/Jujuy', 'America/Argentina/Jujuy'],
  ['America/Louisville', 'America/Kentucky/Louisville'],
  ['America/Mendoza', 'America/Argentina/Mendoza'],
  ['Asia/Calcutta', 'Asia/Kolkata'],
  ['Asia/Katmandu', 'Asia/Kathmandu'],
  ['Asia/Rangoon', 'Asia/Yangon'],
  ['Asia/Saigon', 'Asia/Ho_Chi_Minh'],
  ['Atlantic/Faeroe', 'Atlantic/Faroe'],
  ['Europe/Kiev', 'Europe/Kyiv'],
  ['Pacific/Enderbury', 'Pacific/Kanton'],
  ['Pacific/Ponape', 'Pacific/Pohnpei'],
  ['Pacific/Truk', 'Pacific/Chuuk'],
])

/** The older ICU name for a renamed IANA zone, for runtimes predating it. */
const LEGACY = new Map<string, string>(
  [...RENAMED].map(([older, current]) => [current, older]),
)

/**
 * A stored name as IANA spells it today. Runtimes on ICU still resolve to the
 * names in `RENAMED`, and so did Groups saved before APP-814. Unlike
 * `canonicalTimeZone` it keeps a name this runtime does not know.
 */
export function currentZoneName(zone: string): string {
  return RENAMED.get(zone) ?? zone
}

function acceptsZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * A zone name this runtime's `Intl` accepts for `zone`, falling back to its
 * pre-rename alias (`Europe/Kyiv` -> `Europe/Kiev`) on phones whose ICU
 * predates the rename; null when this runtime knows neither.
 */
export function resolveRuntimeZone(zone: string): string | null {
  if (!zone) return null
  if (acceptsZone(zone)) return zone
  const legacy = LEGACY.get(zone)
  if (legacy && acceptsZone(legacy)) return legacy
  return null
}
