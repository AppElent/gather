/**
 * Whether this person may delete their account from the phone.
 *
 * Deletion is Convex first, Clerk second (ADR-0032), so a Clerk refusal
 * arrives *after* the household is already being purged — leaving a login
 * with nothing behind it. The only safe moment to ask is before either call,
 * which is why the answer here is "yes" only when Clerk has said yes.
 *
 * `deleteSelfEnabled` absent is not a yes. It is what an older SDK, a user
 * object still loading, or a shape we did not expect all look like, and
 * treating any of those as permission is how the worst outcome happens.
 *
 * Three answers rather than a boolean so the screen can keep the button off
 * while Clerk loads without telling somebody it has been withheld.
 */
export type AccountDeletion = 'allowed' | 'withheld' | 'unknown'

export function accountDeletion(
  user: { deleteSelfEnabled?: boolean | null } | null | undefined,
): AccountDeletion {
  if (!user) return 'unknown'
  return user.deleteSelfEnabled === true ? 'allowed' : 'withheld'
}
