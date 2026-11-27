/**
 * Which Members a linked list's people are (APP-405). Nothing is stored: the
 * two are matched each time, by email address, so a Member who leaves the
 * Group or the project stops matching. No address reaches a client.
 */
import type { Doc, Id } from '../_generated/dataModel'
import type { SourcePeople, UnifiedTask } from './taskProviders/types'

type Member = Pick<Doc<'users'>, '_id' | 'email'>

export interface MatchedPeople {
  source: SourcePeople
  /** Each matched person's Member, by the provider's id. */
  matched: ReadonlyMap<string, Id<'users'>>
}

const address = (email: string) => email.trim().toLowerCase()

/**
 * Who of a source's people is which Member. The connection's own account is
 * the Member who connected it when no address says otherwise: an Apple relay
 * address, for one, matches nothing. An address two Members share matches
 * neither.
 */
export function membersOfPeople(
  { people }: SourcePeople,
  members: readonly Member[],
  connectedBy: Id<'users'>,
): Map<string, Id<'users'>> {
  const matched = new Map<string, Id<'users'>>()
  for (const person of people) {
    const email = address(person.email)
    const same = members.filter((each) => email && address(each.email) === email)
    if (same.length === 1) matched.set(person.id, same[0]._id)
  }
  const self = people.find((person) => person.self)
  if (
    self &&
    !matched.has(self.id) &&
    members.some((each) => each._id === connectedBy) &&
    ![...matched.values()].includes(connectedBy)
  ) {
    matched.set(self.id, connectedBy)
  }
  return matched
}

/**
 * A task as a client is sent it: its person as a Member, or by name. Without
 * `people` nobody could be asked; a task someone has is still not nobody's.
 */
export function withAssignee(
  { responsibleId, ...task }: UnifiedTask,
  people: MatchedPeople | null | undefined,
): UnifiedTask {
  if (!responsibleId) return task
  const assigneeId = people?.matched.get(responsibleId)
  if (assigneeId) return { ...task, assigneeId }
  const person = people?.source.people.find((each) => each.id === responsibleId)
  const name = person?.name ?? ''
  // Someone who has not set a name may have their address for one.
  return { ...task, assigneeName: name.includes('@') ? '' : name }
}
