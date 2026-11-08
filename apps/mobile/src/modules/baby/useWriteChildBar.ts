/**
 * Writes a Child's log bar, from the log and from its settings alike.
 *
 * A person sees one arrangement, the bar. The record keeps two questions apart
 * — `untrackedTypes` is which event types the log refuses (ADR-0022) and
 * `barOrder` is where each button sits, shortcuts included — so both are
 * derived from the one list and written together, and `babyBarSlots` reads
 * them back. `babies.update` takes name and birth date as required arguments,
 * so they are resent unchanged.
 */
import {
  type BabyBarSlot,
  type BabyEventType,
  declinedEventTypes,
  isBabyBarShortcut,
} from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { api, type Id } from '../../convex/api'
import { useGroup } from '../../group/GroupProvider'

export function useWriteChildBar() {
  const { group } = useGroup()
  const update = useMutation(api.babies.update)
  return (
    child: { _id: Id<'babies'>; name: string; birthDate: string },
    slots: readonly BabyBarSlot[],
  ) =>
    update({
      id: child._id,
      groupSlug: group.slug,
      name: child.name,
      birthDate: child.birthDate,
      untrackedTypes: declinedEventTypes(
        slots.filter((slot): slot is BabyEventType => !isBabyBarShortcut(slot)),
      ),
      barOrder: [...slots],
    })
}
