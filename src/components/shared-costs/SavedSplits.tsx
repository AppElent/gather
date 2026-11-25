import { Link } from '@tanstack/react-router'
import type { KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { InsetList, InsetRow, SectionLabel } from '../app/InsetList'
import { DetailPanelHeader } from '../app/ListDetailLayout'
import { captionClass, GroundList, GroundRow, TransferList, useMoney } from './parts'
import type { SavedSplit } from './splitDraft'

/** "12 okt", with the year once it is another one. */
function useSavedOn(timeZone: string | undefined) {
  const { locale } = useI18n()
  return (at: number) => {
    const year = (date: Date) =>
      new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(date)
    const date = new Date(at)
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: year(date) === year(new Date()) ? undefined : 'numeric',
      timeZone,
    }).format(date)
  }
}

/** The saved splits, newest first; each opens read-only beside the list. */
export function SavedSplitList({
  splits,
  openId,
  timeZone,
}: {
  splits: readonly SavedSplit[]
  openId?: string
  timeZone?: string
}) {
  const { messages } = useI18n()
  const words = messages.finances.split
  const money = useMoney()
  const savedOn = useSavedOn(timeZone)
  if (splits.length === 0) return null

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step =
      event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('a[href]'),
    )
    const next = rows[rows.indexOf(event.target as HTMLElement) + step]
    if (!next) return
    event.preventDefault()
    next.focus()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the rows inside, which are the controls
    <div data-saved-splits="" onKeyDown={onKeyDown}>
      <SectionLabel>{words.saved}</SectionLabel>
      <InsetList label={words.saved}>
        {splits.map((split) => (
          <InsetRow
            key={split._id}
            title={split.name}
            footnote={`${savedOn(split.createdAt)} · ${money(split.totalCents)}`}
            link={{ ...linkTo('shared-costs'), search: { split: split._id } }}
            selected={split._id === openId}
          />
        ))}
      </InsetList>
    </div>
  )
}

/** One saved split, as it was kept: no field on it can be edited. */
export function SavedSplitView({
  split,
  timeZone,
  level,
  onClose,
  onDuplicate,
}: {
  split: SavedSplit
  timeZone?: string
  level: 1 | 2
  onClose?: () => void
  onDuplicate: () => void
}) {
  const { messages } = useI18n()
  const { actions, split: words } = messages.finances
  const money = useMoney()
  const savedOn = useSavedOn(timeZone)
  return (
    <div className="grid gap-4 p-4">
      <DetailPanelHeader
        level={level}
        title={split.name}
        subtitle={`${savedOn(split.createdAt)} · ${money(split.totalCents)}`}
        onClose={onClose}
      />
      <div className="grid gap-1.5">
        <h3 className={captionClass}>{words.whoPaid}</h3>
        <GroundList label={words.whoPaid}>
          {split.payments.map((payment, index) => (
            <GroundRow
              // Immutable rows: the order is the identity.
              key={`${payment.party.name}-${index}`}
              coin
              name={payment.party.name}
              footnote={payment.label}
              value={money(payment.amountCents)}
            />
          ))}
        </GroundList>
      </div>
      <div className="grid gap-1.5">
        <h3 className={captionClass}>
          {words.splitBetween} ·{' '}
          {split.mode === 'equal' ? words.equally : words.custom}
        </h3>
        <GroundList label={words.splitBetween}>
          {split.owed.map((owed, index) => (
            <GroundRow
              key={`${owed.party.name}-${index}`}
              coin
              name={owed.party.name}
              value={money(owed.amountCents)}
            />
          ))}
        </GroundList>
      </div>
      <div className="grid gap-1.5">
        <h3 className={captionClass}>{words.toSettle}</h3>
        <TransferList
          transfers={split.transfers.map((transfer) => ({
            from: transfer.from.name,
            to: transfer.to.name,
            amountCents: transfer.amountCents,
          }))}
        />
      </div>
      <button
        type="button"
        onClick={onDuplicate}
        className={`${buttonClass.primary} w-full`}
      >
        {actions.duplicate}
      </button>
      <p className="m-0 text-footnote text-[var(--muted)]">{words.immutable}</p>
    </div>
  )
}

/** The address names a split that is not here. */
export function SavedSplitMissing({ level }: { level: 1 | 2 }) {
  const { messages } = useI18n()
  const words = messages.finances.split.web
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
      <Heading className="m-0 font-rounded text-title-2 font-bold">
        {words.missingTitle}
      </Heading>
      <p className="m-0 max-w-[36ch] text-subhead text-[var(--muted)]">
        {words.missingBody}
      </p>
      <Link {...linkTo('shared-costs')} className={buttonClass.secondary}>
        {words.toCalculator}
      </Link>
    </div>
  )
}
