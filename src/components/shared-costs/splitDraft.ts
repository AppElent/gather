/**
 * What the calculator on the page holds, and what it turns into.
 *
 * The arithmetic is `@gather/core/finance`'s, shared with the phone; here is
 * only the draft around it. It lives in component state and nowhere else: not
 * in the URL, not in storage (ADR-0025).
 */

import {
  customCoversTotal,
  fromCents,
  parseCents,
  type SplitMode,
  type SplitResult,
  splitEvent,
} from '@gather/core/finance'
import type { FunctionArgs } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export type SavedSplit = Doc<'splitScenarios'>
type SaveArgs = FunctionArgs<typeof api.splitScenarios.save>
type Party = SavedSplit['participants'][number]

/** Someone a split can be about: a Member, or a name a saved split kept. */
export interface Person {
  id: string
  name: string
  /** Absent for somebody who has left the Group. */
  userId?: Id<'users'>
}

export interface DraftPayment {
  key: number
  personId: string
  /** Kept, so a payer who leaves mid-calculation is still named. */
  personName: string
  amountCents: number
  label?: string
}

export interface SplitDraft {
  what: string
  payments: DraftPayment[]
  /** Null for everybody, so a Member who joins is in it. */
  participantIds: string[] | null
  mode: SplitMode
  /** The typed text, so a half-typed amount is not reformatted. */
  customAmounts: Record<string, string>
  /** People a duplicated split names who are no longer Members. */
  former: Person[]
}

export const EMPTY_DRAFT: SplitDraft = {
  what: '',
  payments: [],
  participantIds: null,
  mode: 'equal',
  customAmounts: {},
  former: [],
}

export function isBlank(draft: SplitDraft): boolean {
  return draft.payments.length === 0 && draft.what.trim() === ''
}

export function newPayment(
  draft: SplitDraft,
  payment: Omit<DraftPayment, 'key'>,
): DraftPayment {
  const key = Math.max(0, ...draft.payments.map((each) => each.key)) + 1
  return { key, ...payment }
}

/** An amount as its box shows it: the reader's decimal mark, no grouping. */
export function amountText(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(fromCents(cents))
}

/** Everybody the draft can name: the Members, and whoever it still needs. */
export function peopleOf(
  members: readonly Person[],
  draft: SplitDraft,
): Person[] {
  const people = new Map<string, Person>()
  for (const person of [...members, ...draft.former])
    people.set(person.id, person)
  for (const { personId, personName } of draft.payments)
    if (!people.has(personId))
      people.set(personId, { id: personId, name: personName })
  return [...people.values()]
}

export interface Outcome {
  participantIds: string[]
  result: SplitResult
  /** The amounts are numbers and hand out exactly what was paid. */
  balances: boolean
}

export function outcomeOf(
  draft: SplitDraft,
  people: readonly Person[],
): Outcome {
  const participantIds = draft.participantIds
    ? draft.participantIds.filter((id) => people.some((each) => each.id === id))
    : people.map((person) => person.id)
  const cents = participantIds.map((id) => {
    const typed = draft.customAmounts[id] ?? ''
    return typed.trim() === '' ? 0 : parseCents(typed)
  })
  const input = {
    payments: draft.payments.map((payment) => ({
      memberId: payment.personId,
      amountCents: payment.amountCents,
    })),
    participantIds,
    mode: draft.mode,
    customCents: Object.fromEntries(
      participantIds.map((id, index) => [id, cents[index] ?? 0]),
    ),
  }
  return {
    participantIds,
    result: splitEvent(input),
    balances:
      participantIds.length > 0 &&
      customCoversTotal(input) &&
      (draft.mode === 'equal' ||
        cents.every((amount) => amount !== null && amount >= 0)),
  }
}

/** The amounts Custom starts from: the split as it is now. */
export function customFrom(
  result: SplitResult,
  locale: string,
): Record<string, string> {
  return Object.fromEntries(
    [...result.owedCents].map(([id, cents]) => [id, amountText(cents, locale)]),
  )
}

export function savePayload(
  groupSlug: string,
  name: string,
  draft: SplitDraft,
  outcome: Outcome,
  people: readonly Person[],
): SaveArgs {
  const party = (id: string): Party => {
    const person = people.find((each) => each.id === id)
    return { userId: person?.userId, name: person?.name ?? '' }
  }
  const { participantIds, result } = outcome
  return {
    groupSlug,
    name,
    payments: draft.payments.map((payment) => ({
      party: party(payment.personId),
      amountCents: payment.amountCents,
      label: payment.label,
    })),
    participants: participantIds.map(party),
    mode: draft.mode,
    owed: participantIds.map((id) => ({
      party: party(id),
      amountCents: result.owedCents.get(id) ?? 0,
    })),
    transfers: result.transfers.map((transfer) => ({
      from: party(transfer.fromMemberId),
      to: party(transfer.toMemberId),
      amountCents: transfer.amountCents,
    })),
    totalCents: result.totalCents,
  }
}

/**
 * A saved split's inputs, back in the calculator. Somebody who has left keeps
 * their part under the name the split kept, so the figures do not change.
 */
export function duplicateOf(
  split: SavedSplit,
  members: readonly Person[],
  locale: string,
): SplitDraft {
  const former = new Map<string, Person>()
  const idOf = (party: Party): string => {
    const member = members.find((each) => each.userId === party.userId)
    if (party.userId && member) return member.id
    const id = `former:${party.userId ?? party.name}`
    former.set(id, { id, name: party.name })
    return id
  }
  return {
    what: split.name,
    payments: split.payments.map((payment, index) => ({
      key: index + 1,
      personId: idOf(payment.party),
      personName: payment.party.name,
      amountCents: payment.amountCents,
      label: payment.label,
    })),
    participantIds: split.participants.map(idOf),
    mode: split.mode,
    customAmounts:
      split.mode === 'custom'
        ? Object.fromEntries(
            split.owed.map((owed) => [
              idOf(owed.party),
              amountText(owed.amountCents, locale),
            ]),
          )
        : {},
    former: [...former.values()],
  }
}
