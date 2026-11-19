/**
 * Which ways out of the Current Group the phone offers, drawn from the
 * server's own answer (`groups.leaveStatus`) rather than from counting
 * Members: `groups.members` skips a membership whose user record is gone, so a
 * count of it can disagree with what `groups.leaveGroup` allows (APP-362).
 *
 * - The last Member is not offered Leave: walking out would leave a Group with
 *   no Members. They are offered Delete instead, whatever their role.
 * - The only admin, while others remain, sees Leave held back. The phone
 *   cannot change roles (Members are managed on the web, ADR-0042), so the
 *   server's refusal would name a fix the reader cannot make here; the button
 *   says so before it is pressed instead.
 * - An admin with others still in the Group sees Delete held back.
 */
import type { FunctionReturnType } from 'convex/server'

import type { api } from '../convex/api'

export type LeaveStatus = FunctionReturnType<typeof api.groups.leaveStatus>

/**
 * `offer`: pressable. `only-admin` and `others-first`: shown disabled, with a
 * note saying why. `wait`: disabled while the server answers. `hidden`: not shown.
 */
export interface GroupExits {
  leave: 'offer' | 'only-admin' | 'hidden' | 'wait'
  delete: 'offer' | 'others-first' | 'hidden' | 'wait'
}

export function groupExits(
  myRole: 'admin' | 'member' | undefined,
  /** The server's answer; `undefined` while loading. */
  status: LeaveStatus | undefined,
): GroupExits {
  const isAdmin = myRole === 'admin'
  if (status === undefined) {
    return { leave: 'wait', delete: isAdmin ? 'wait' : 'hidden' }
  }
  if (status.leave === 'last-member') return { leave: 'hidden', delete: 'offer' }
  return {
    leave: status.leave === 'only-admin' ? 'only-admin' : 'offer',
    delete: !isAdmin ? 'hidden' : status.canDelete ? 'offer' : 'others-first',
  }
}
