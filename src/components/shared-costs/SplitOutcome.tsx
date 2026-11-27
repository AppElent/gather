import { useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { EmptyState } from '../app/EmptyState'
import { captionClass, TransferList, useAcross, useMoney } from './parts'
import type { Outcome, Person, SplitDraft } from './splitDraft'

/**
 * The figure a split comes down to. "Each" is only a fair word for an equal
 * one; a custom split has no single figure, so it shows the total.
 */
function useHeadline(draft: SplitDraft, { result }: Outcome) {
  const money = useMoney()
  const across = useAcross()
  const words = useMessages().finances.split
  const equal = draft.mode === 'equal'
  const each = result.owedCents.values().next().value ?? 0
  return {
    amount: money(equal ? each : result.totalCents),
    unit: equal ? words.barEach : undefined,
    sub: across(result.totalCents, result.owedCents.size),
  }
}

/** The answer. Below `lg` its figure and Save are in `OutcomeBar` instead. */
export function SplitOutcome({
  draft,
  outcome,
  people,
  onSave,
}: {
  draft: SplitDraft
  outcome: Outcome
  people: readonly Person[]
  onSave: () => void
}) {
  const { errors, split: words } = useMessages().finances
  const { amount, unit, sub } = useHeadline(draft, outcome)
  const nameOf = (id: string) =>
    people.find((person) => person.id === id)?.name ?? ''

  if (draft.payments.length === 0)
    return (
      <EmptyState
        kind="nothing-for-you"
        title={words.emptyTitle}
        body={words.emptyBody}
      />
    )

  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] bg-[var(--surface)] p-4">
      <div className="max-lg:hidden">
        <p className="m-0 font-rounded text-large-title font-bold tabular-nums">
          {amount}
          {unit ? (
            <>
              {' '}
              <span className="font-sans text-subhead font-normal text-[var(--muted)]">
                {unit}
              </span>
            </>
          ) : null}
        </p>
        <p className="m-0 text-subhead text-[var(--muted)] tabular-nums">
          {sub}
        </p>
      </div>
      <div className="grid gap-1.5">
        <h2 className={captionClass}>{words.toSettle}</h2>
        {outcome.balances ? (
          <TransferList
            transfers={outcome.result.transfers.map((transfer) => ({
              from: nameOf(transfer.fromMemberId),
              to: nameOf(transfer.toMemberId),
              amountCents: transfer.amountCents,
            }))}
          />
        ) : (
          <p className="m-0 text-subhead">{errors.customTotal}</p>
        )}
      </div>
      <button
        type="button"
        disabled={!outcome.balances}
        onClick={onSave}
        className={`${buttonClass.primary} w-full max-lg:hidden`}
      >
        {words.saveThis}
      </button>
      <p className="m-0 text-footnote text-[var(--muted)]">{words.immutable}</p>
    </section>
  )
}

/**
 * Below `lg`: the answer in a glass bar. On a phone it floats above the tabs
 * (`MobileDock`: 62 px, 20 px up); beside the sidebar it sticks to the bottom.
 */
export function OutcomeBar({
  draft,
  outcome,
  onSave,
}: {
  draft: SplitDraft
  outcome: Outcome
  onSave: () => void
}) {
  const words = useMessages().finances.split
  const { amount, unit, sub } = useHeadline(draft, outcome)
  return (
    <div
      data-testid="outcome-bar"
      className="tab-bar-glass z-20 flex items-center gap-3 rounded-[var(--radius-card)] py-2.5 pr-2.5 pl-4 max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(92px+env(safe-area-inset-bottom))] md:sticky md:bottom-5 lg:hidden"
    >
      <div className="min-w-0 flex-1 tabular-nums">
        <p className="m-0 text-body font-bold">
          {amount}
          {unit ? (
            <span className="text-footnote font-normal"> {unit}</span>
          ) : null}
        </p>
        <p className="m-0 text-footnote text-[var(--muted)]">{sub}</p>
      </div>
      <button
        type="button"
        disabled={!outcome.balances}
        onClick={onSave}
        className={`${buttonClass.primary} shrink-0`}
      >
        {words.saveThis}
      </button>
    </div>
  )
}
