import { formatMoney } from '@gather/core/finance'
import { type ReactNode, useCallback } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { initialsOf } from '../app/AccountMenu'

/** Every Group counts in euros; there is no setting and no conversion. */
const CURRENCY = 'EUR'

export function useMoney(): (cents: number) => string {
  const { locale } = useI18n()
  return useCallback((cents) => formatMoney(cents, CURRENCY, locale), [locale])
}

/** "€ 1.260,00 over 3 personen". */
export function useAcross(): (totalCents: number, count: number) => string {
  const { messages } = useI18n()
  const money = useMoney()
  const words = messages.finances.split
  return (totalCents, count) =>
    fmt(count === 1 ? words.web.barSubOne : words.barSub, {
      total: money(totalCents),
      count,
    })
}

export const captionClass =
  'm-0 text-footnote font-semibold text-[var(--muted)]'

/** A person's 28 px coin. */
export function Coin({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[var(--size-tile-s)] shrink-0 place-items-center rounded-full bg-[var(--money-wash)] text-[11px] font-bold text-[var(--ink)]"
    >
      {initialsOf(name, null)}
    </span>
  )
}

/** Rows on `ground`, inside a `surface` card. */
export function GroundList({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 list-none rounded-[var(--radius-control)] bg-[var(--ground)] px-3 py-0"
    >
      {children}
    </ul>
  )
}

export function GroundRow({
  name,
  footnote,
  coin,
  value,
  children,
}: {
  name: string
  footnote?: string
  coin?: boolean
  value?: string
  /** A control at the row's end. */
  children?: ReactNode
}) {
  return (
    <li className="flex min-h-[var(--size-row-min)] items-center gap-3 py-2 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]">
      {coin ? <Coin name={name} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-body break-words">{name}</span>
        {footnote ? (
          <span className="block text-footnote text-[var(--muted)]">
            {footnote}
          </span>
        ) : null}
      </span>
      {value ? (
        <span className="shrink-0 text-body font-semibold tabular-nums">
          {value}
        </span>
      ) : null}
      {children}
    </li>
  )
}

/** "{from} pays {to}", or that there is nothing to settle. */
export function TransferList({
  transfers,
}: {
  transfers: readonly { from: string; to: string; amountCents: number }[]
}) {
  const { messages } = useI18n()
  const money = useMoney()
  const words = messages.finances.split
  return (
    <GroundList label={words.toSettle}>
      {transfers.length === 0 ? (
        <GroundRow name={words.settled} />
      ) : (
        transfers.map((transfer, index) => (
          <GroundRow
            // Frozen rows: the order is the identity.
            key={`${transfer.from}-${transfer.to}-${index}`}
            name={fmt(words.pays, { from: transfer.from, to: transfer.to })}
            value={money(transfer.amountCents)}
          />
        ))
      )}
    </GroundList>
  )
}
