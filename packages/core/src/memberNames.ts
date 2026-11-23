/**
 * Short names for Members (APP-372): the week menu says "zonder Sam", not
 * "zonder Sam Okonkwo".
 *
 * A Member's short name is the first word of their display name. When two
 * Members share that first word (ignoring case and accents), both keep their
 * full name, so a label never names two people the same way. A blank name
 * stays blank; the caller decides what to show instead.
 */

export interface NamedMember {
  id: string
  name: string
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The first word of a display name, or the whole (trimmed) name. */
export function firstName(name: string): string {
  const trimmed = name.trim()
  return trimmed.split(/\s+/u)[0] ?? trimmed
}

/** Each Member's short name by id, unique within `members`. */
export function memberFirstNames(
  members: readonly NamedMember[],
): Map<string, string> {
  const counts = new Map<string, number>()
  for (const member of members) {
    const key = fold(firstName(member.name))
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Map(
    members.map((member) => {
      const first = firstName(member.name)
      const shared = (counts.get(fold(first)) ?? 0) > 1
      return [member.id, shared ? member.name.trim() : first]
    }),
  )
}

/**
 * The name an app reads from its signed-in Clerk user, sent to
 * `users.ensureUser` (APP-676): the full name, else first and last name, else
 * the username. Undefined when the account has none of them.
 */
export function clerkUserName(
  user:
    | {
        fullName?: string | null
        firstName?: string | null
        lastName?: string | null
        username?: string | null
      }
    | null
    | undefined,
): string | undefined {
  if (!user) return undefined
  const clean = (value?: string | null) =>
    (value ?? '').trim().replace(/\s+/g, ' ')
  const parts = [clean(user.firstName), clean(user.lastName)]
    .filter(Boolean)
    .join(' ')
  return clean(user.fullName) || parts || clean(user.username) || undefined
}
