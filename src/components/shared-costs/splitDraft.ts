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
  /**
   * The name of everybody the draft has counted, by person id, so whoever
   * leaves the Group meanwhile keeps their part.
   */
  names: Record<string, string>
}

export const EMPTY_DRAFT: SplitDraft = {
  what: '',
  payments: [],
  participantIds: null,
  mode: 'equal',
  customAmounts: {},
  names: {},
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

/** Everybody the draft can name: the Members, and whoever it counted before. */
export function peopleOf(
  members: readonly Person[],
  draft: SplitDraft,
): Person[] {
  const gone = Object.entries(draft.names)
    .filter(([id]) => !members.some((member) => member.id === id))
    .map(([id, name]) => ({ id, name }))
  return [...members, ...gone]
}

/** The draft's names, with these people's. */
export function namesWith(
  draft: SplitDraft,
  people: readonly Person[],
  ids: readonly string[],
): SplitDraft['names'] {
  const counted = people.filter((person) => ids.includes(person.id))
  return {
    ...draft.names,
    ...Object.fromEntries(counted.map(({ id, name }) => [id, name])),
  }
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
  const names: Record<string, string> = {}
  const name = (id: string, party: Party) => {
    names[id] = party.name
    return id
  }
  /**
   * Leaving the Group takes the id off a party and keeps the name, so two who
   * left can share one: `participants` and `owed` list the same people in the
   * same order, and a repeat is told apart by its turn.
   */
  const idsOf = (parties: readonly Party[]): string[] => {
    const turns = new Map<string, number>()
    return parties.map((party) => {
      const id = idOf(party)
      const turn = (turns.get(id) ?? 0) + 1
      turns.set(id, turn)
      return name(turn === 1 ? id : `${id}#${turn}`, party)
    })
  }
  const idOf = (party: Party): string =>
    members.find((each) => party.userId && each.userId === party.userId)?.id ??
    `former:${party.userId ?? party.name}`

  const participantIds = idsOf(split.participants)
  const owedIds = idsOf(split.owed.map((owed) => owed.party))
  return {
    what: split.name,
    payments: split.payments.map((payment, index) => ({
      key: index + 1,
      personId: name(idOf(payment.party), payment.party),
      amountCents: payment.amountCents,
      label: payment.label,
    })),
    participantIds,
    mode: split.mode,
    customAmounts:
      split.mode === 'custom'
        ? Object.fromEntries(
            split.owed.map((owed, index) => [
              owedIds[index],
              amountText(owed.amountCents, locale),
            ]),
          )
        : {},
    names,
  }
}
