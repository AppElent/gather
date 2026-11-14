import { foldForSearch } from '@gather/core/loyalty-cards'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { formatActivityTime } from '../../lib/groupActivity'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { StoreTile } from './StoreTile'

/**
 * The Current Group's Loyalty cards: last used first, then by store.
 */
export function LoyaltyCardsPage() {
  const group = useRequiredCurrentGroup()
  const cards = useQuery(api.loyaltyCards.list, { groupSlug: group.slug })
  const { locale, messages } = useI18n()
  const copy = messages.loyaltyCards.index
  const [filter, setFilter] = useState('')

  const needle = foldForSearch(filter)
  const shown = (cards ?? []).filter(
    (card) =>
      !needle ||
      foldForSearch(`${card.storeName} ${card.holder ?? ''}`).includes(needle),
  )

  const addLink = (
    <Link
      {...linkTo('newLoyaltyCard')}
      aria-label={copy.add}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{copy.add}</span>
    </Link>
  )

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">
            {messages.modules.byId['loyalty-cards'].label}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {copy.subtitle}
          </p>
        </div>
        {addLink}
      </header>

      {cards === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-20 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <SurfaceCard className="grid justify-items-center gap-3 py-10 text-center">
          <h2 className="m-0 text-lg font-semibold">{copy.emptyTitle}</h2>
          <p className="m-0 max-w-lg text-sm text-[var(--app-muted)]">
            {fmt(copy.emptyBody, { group: group.name })}
          </p>
          <Link
            {...linkTo('newLoyaltyCard')}
            className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
          >
            {copy.emptyAction}
          </Link>
        </SurfaceCard>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">{copy.filter}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]"
              aria-hidden="true"
            />
            <input
              className="min-h-11 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-10 text-[16px] sm:text-sm"
              type="search"
              placeholder={copy.filter}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            {filter ? (
              <button
                type="button"
                aria-label={copy.clearFilter}
                className="absolute right-1 top-1/2 grid min-h-9 min-w-9 -translate-y-1/2 place-items-center"
                onClick={() => setFilter('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>

          {shown.length === 0 ? (
            <SurfaceCard className="text-center">
              <p className="m-0 text-sm text-[var(--app-muted)]">
                {copy.filterEmpty}
              </p>
            </SurfaceCard>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((card) => (
                <li key={card._id}>
                  <Link
                    {...linkTo('loyaltyCard', { cardId: card._id })}
                    className="flex min-h-20 items-center gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-[var(--app-fg)] no-underline hover:bg-[var(--app-surface-muted)]"
                  >
                    <StoreTile name={card.storeName} color={card.brandColor} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {card.storeName}
                      </span>
                      {card.holder ? (
                        <span className="block truncate text-sm">
                          {card.holder}
                        </span>
                      ) : null}
                      <span className="block truncate text-xs text-[var(--app-muted)]">
                        {card.lastUsedAt
                          ? fmt(copy.usedAt, {
                              when: formatActivityTime(
                                card.lastUsedAt,
                                messages,
                                locale,
                              ),
                            })
                          : copy.neverUsed}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
