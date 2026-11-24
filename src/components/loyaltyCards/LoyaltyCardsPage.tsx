import { cardsInArrangement, foldForSearch } from '@gather/core/loyalty-cards'
import { movePin } from '@gather/core/pins'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatActivityTime } from '../../lib/groupActivity'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { StoreTile } from './StoreTile'

const BUTTON =
  'inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] px-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40'

/**
 * The Current Group's Loyalty cards, in Convex's order: cards nobody arranged
 * on top (last used first, then by store), then the Group's own arrangement.
 *
 * Reorder is a mode (APP-440), as on the phone: the filter and the links go
 * away, each card gets move up and move down buttons like the pins on `/all`,
 * and every move saves at once. Done leaves it.
 */
export function LoyaltyCardsPage() {
  const group = useRequiredCurrentGroup()
  const groupSlug = group.slug
  const cards = useQuery(api.loyaltyCards.list, { groupSlug })
  const reorder = useMutation(api.loyaltyCards.reorder).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.loyaltyCards.list, {
        groupSlug: args.groupSlug,
      })
      if (!current) return
      store.setQuery(
        api.loyaltyCards.list,
        { groupSlug: args.groupSlug },
        cardsInArrangement(current, args.ids),
      )
    },
  )
  const { locale, messages } = useI18n()
  const copy = messages.loyaltyCards.index
  const [filter, setFilter] = useState('')
  const [reordering, setReordering] = useState(false)
  const [failed, setFailed] = useState(false)
  // What a screen reader says after a move: the buttons keep focus, so
  // nothing else tells it the card went anywhere.
  const [announcement, setAnnouncement] = useState('')
  // The arrow to focus once a move lands a card at an end, where the one just
  // pressed turns disabled and would drop focus to the page.
  const [focusNext, setFocusNext] = useState<string | null>(null)

  const canReorder = (cards?.length ?? 0) >= 2
  const arranging = reordering && canReorder
  // Down to one card, the mode ends, so a card added later doesn't reopen it.
  if (reordering && cards !== undefined && !canReorder) setReordering(false)

  const move = (id: string, direction: 'up' | 'down') => {
    const ids = (cards ?? []).map((card) => card._id as string)
    const next = movePin(ids, id, direction)
    const at = next.indexOf(id)
    if (direction === 'up' && at === 0) setFocusNext(`${id}:down`)
    if (direction === 'down' && at === next.length - 1) setFocusNext(`${id}:up`)
    const card = (cards ?? []).find((each) => each._id === id)
    setFailed(false)
    setAnnouncement(
      card
        ? fmt(copy.moved, {
            store: storeLabel(card),
            position: at + 1,
            total: next.length,
          })
        : '',
    )
    reorder({ groupSlug, ids: next as Id<'loyaltyCards'>[] }).catch(() => {
      setAnnouncement('')
      setFailed(true)
    })
  }
  useEffect(() => {
    if (!focusNext) return
    document
      .querySelector<HTMLButtonElement>(`[data-move="${focusNext}"]`)
      ?.focus()
    setFocusNext(null)
  }, [focusNext])

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
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] text-[var(--ink)] no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{copy.add}</span>
    </Link>
  )

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 font-rounded text-2xl font-bold">
            {messages.modules.byId['loyalty-cards'].label}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {copy.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {arranging ? (
            <button
              type="button"
              className={BUTTON}
              onClick={() => setReordering(false)}
            >
              {copy.reorderDone}
            </button>
          ) : (
            <>
              {canReorder && !needle ? (
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={copy.reorder}
                  onClick={() => {
                    setFilter('')
                    setFailed(false)
                    setAnnouncement('')
                    setReordering(true)
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">{copy.reorder}</span>
                </button>
              ) : null}
              {addLink}
            </>
          )}
        </div>
      </header>

      {failed ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {messages.common.errors.didNotWork}
        </p>
      ) : null}

      {cards === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-20 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <SurfaceCard className="grid justify-items-center gap-3 py-10 text-center">
          <h2 className="m-0 text-lg font-semibold">{copy.emptyTitle}</h2>
          <p className="m-0 max-w-lg text-sm text-[var(--muted)]">
            {fmt(copy.emptyBody, { group: group.name })}
          </p>
          <Link
            {...linkTo('newLoyaltyCard')}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--hair)] px-3 text-sm font-semibold text-[var(--ink)] no-underline"
          >
            {copy.emptyAction}
          </Link>
        </SurfaceCard>
      ) : arranging ? (
        <>
          <p className="m-0 text-sm text-[var(--muted)]">
            {fmt(copy.reorderShared, { group: group.name })}
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
          <ol
            aria-label={copy.reorder}
            className="m-0 grid list-none gap-0 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-0"
          >
            {cards.map((card, index) => (
              <li
                key={card._id}
                className="flex items-center gap-3 border-t border-[var(--hair)] px-3 py-2 first:border-t-0"
              >
                <StoreTile
                  name={card.storeName}
                  color={card.brandColor}
                  catalogKey={card.catalogKey}
                  decorative
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {card.storeName}
                  </span>
                  {card.holder ? (
                    <span className="block truncate text-sm">
                      {card.holder}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={BUTTON}
                    data-move={`${card._id}:up`}
                    disabled={index === 0}
                    aria-label={fmt(copy.moveUp, { store: storeLabel(card) })}
                    onClick={() => move(card._id, 'up')}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    data-move={`${card._id}:down`}
                    disabled={index === cards.length - 1}
                    aria-label={fmt(copy.moveDown, { store: storeLabel(card) })}
                    onClick={() => move(card._id, 'down')}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">{copy.filter}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] pl-10 pr-10 text-[16px] sm:text-sm"
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
              <p className="m-0 text-sm text-[var(--muted)]">
                {copy.filterEmpty}
              </p>
            </SurfaceCard>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((card) => (
                <li key={card._id}>
                  <Link
                    {...linkTo('loyaltyCard', { cardId: card._id })}
                    className="flex min-h-20 items-center gap-3 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-3 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
                  >
                    <StoreTile
                      name={card.storeName}
                      color={card.brandColor}
                      catalogKey={card.catalogKey}
                      decorative
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {card.storeName}
                      </span>
                      {card.holder ? (
                        <span className="block truncate text-sm">
                          {card.holder}
                        </span>
                      ) : null}
                      <span className="block truncate text-xs text-[var(--muted)]">
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

/** A card's name for a button label: the holder tells two Bonuskaarten apart. */
function storeLabel(card: { storeName: string; holder?: string }): string {
  return card.holder ? `${card.storeName} (${card.holder})` : card.storeName
}
