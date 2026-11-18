/**
 * Whether the phone may offer Leave, drawn from the server's own rule
 * (`groups.leaveGroup`): the only admin cannot walk out while anyone else is
 * still in the Group, because nobody left could rename, delete or hand it on.
 *
 * The phone cannot change roles (Members are managed on the web, ADR-0042), so
 * the server's refusal would name a fix the reader cannot make here. The
 * button says so before it is pressed instead.
 */
export type LeaveRule = 'allowed' | 'only-admin' | 'unknown'

export function leaveRule(
  myRole: 'admin' | 'member' | undefined,
  /** Every Member of the Group, including the reader; `undefined` while loading. */
  members: readonly { role: 'admin' | 'member' }[] | undefined,
): LeaveRule {
  if (myRole === undefined) return 'unknown'
  // A Member who is not an admin takes nothing with them the Group needs.
  if (myRole === 'member') return 'allowed'
  if (members === undefined) return 'unknown'
  const othersRemain = members.length > 1
  const admins = members.filter((member) => member.role === 'admin').length
  // The reader is one of `admins`; a second one means the Group keeps one.
  return othersRemain && admins <= 1 ? 'only-admin' : 'allowed'
}
