import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Pencil } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatActivityTime } from '../../lib/groupActivity'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { Barcode } from './Barcode'
import { StoreTile } from './StoreTile'

/**
 * One card, ready for the till: the barcode large, the number under it, and
 * the card's details below. Opening it counts as using it (`markUsed`), which
 * is what moves the card to the top of the list.
 */
export function LoyaltyCardPage({ cardId }: { cardId: string }) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const id = cardId as Id<'loyaltyCards'>
  const card = useQuery(api.loyaltyCards.get, { groupSlug, id })
  const markUsed = useMutation(api.loyaltyCards.markUsed)
  const { locale, messages } = useI18n()
  const copy = messages.loyaltyCards.detail
  // `lastUsedAt` from before this visit, so the page does not report the
  // visit it is itself recording as "Just now".
  const previousUse = useRef<{ id: string; at: number | undefined } | null>(
    null,
  )
  if (card && previousUse.current?.id !== card._id) {
    previousUse.current = { id: card._id, at: card.lastUsedAt }
  }

  const loadedId = card?._id
  useEffect(() => {
    if (!loadedId) return
    // Best effort: the sort order is not worth an error on the page that is
    // being shown at a till.
    markUsed({ groupSlug, id: loadedId }).catch(() => {})
  }, [groupSlug, loadedId, markUsed])

  const moduleCrumb: Crumb = {
    label: messages.modules.byId['loyalty-cards'].label,
    link: linkTo('loyalty-cards'),
  }

  if (card === undefined || card === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs
          trail={[moduleCrumb, { label: card === null ? copy.notFound : '…' }]}
        />
        <p className="text-sm text-[var(--app-muted)]">
          {card === null ? copy.notFound : messages.common.errors.loading}
        </p>
      </div>
    )
  }

  const title = card.holder
    ? `${card.storeName} · ${card.holder}`
    : card.storeName
  const formatName = messages.loyaltyCards.formats[card.barcodeFormat]
  const lastUsed = previousUse.current?.at

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Breadcrumbs trail={[moduleCrumb, { label: title }]} className="mb-0" />

      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <StoreTile
            name={card.storeName}
            color={card.brandColor}
            catalogKey={card.catalogKey}
          />
          <div className="min-w-0">
            <h2 className="m-0 truncate text-2xl font-semibold">
              {card.storeName}
            </h2>
            {card.holder ? (
              <p className="m-0 truncate text-sm text-[var(--app-muted)]">
                {card.holder}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          {...linkTo('editLoyaltyCard', { cardId: card._id })}
          aria-label={messages.common.actions.edit}
          className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">
            {messages.common.actions.edit}
          </span>
        </Link>
      </header>

      <section
        aria-label={copy.showAtTill}
        className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 sm:p-4"
      >
        <Barcode
          format={card.barcodeFormat}
          value={card.cardNumber}
          label={fmt(copy.barcodeLabel, {
            format: formatName,
            store: card.storeName,
          })}
        />
        <div className="text-center">
          <p className="m-0 text-xs uppercase tracking-wide text-[var(--app-muted)]">
            {copy.cardNumber} · {formatName}
          </p>
          <p className="m-0 select-all break-all font-mono text-xl tracking-widest">
            {card.cardNumber}
          </p>
        </div>
      </section>

      <dl className="m-0 grid gap-3 text-sm sm:grid-cols-2">
        {card.note ? (
          <div className="sm:col-span-2">
            <dt className="font-medium">{copy.note}</dt>
            <dd className="m-0 whitespace-pre-wrap text-[var(--app-muted)]">
              {card.note}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium">{copy.lastUsed}</dt>
          <dd className="m-0 text-[var(--app-muted)]">
            {lastUsed
              ? formatActivityTime(lastUsed, messages, locale)
              : messages.loyaltyCards.index.neverUsed}
          </dd>
        </div>
      </dl>

      {card.frontPhotoUrl || card.backPhotoUrl ? (
        <section className="grid gap-2">
          <h3 className="m-0 text-base font-semibold">{copy.photos}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {card.frontPhotoUrl ? (
              <img
                src={card.frontPhotoUrl}
                alt={messages.loyaltyCards.form.frontPhoto}
                className="w-full rounded-[var(--app-radius)] border border-[var(--app-border)] object-cover"
              />
            ) : null}
            {card.backPhotoUrl ? (
              <img
                src={card.backPhotoUrl}
                alt={messages.loyaltyCards.form.backPhoto}
                className="w-full rounded-[var(--app-radius)] border border-[var(--app-border)] object-cover"
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
