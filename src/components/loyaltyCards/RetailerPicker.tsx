import { useQuery } from 'convex/react'
import { Plus, Search } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { fmt, useMessages } from '../../lib/i18n'
import { inputClass } from '../recipes/fields'
import { StoreTile } from './StoreTile'

/**
 * Step one of adding a card: find the store in the Retailer catalog, or add
 * one by name. The search runs in Convex (`loyaltyCards.searchCatalog`), by
 * name and alias, ignoring case and accents.
 */
export function RetailerPicker({
  onPick,
  onOtherStore,
}: {
  onPick: (retailer: RetailerSuggestion) => void
  onOtherStore: () => void
}) {
  const messages = useMessages()
  const copy = messages.loyaltyCards.picker
  const [query, setQuery] = useState('')
  const results = useQuery(api.loyaltyCards.searchCatalog, { query })
  // Keep the last answer on screen while the next query is in flight, so the
  // list does not blink empty on every keystroke.
  const last = useRef<RetailerSuggestion[] | undefined>(undefined)
  if (results !== undefined) last.current = results
  const shown = results ?? last.current
  const inputId = useId()

  return (
    <div className="grid gap-3">
      <label htmlFor={inputId} className="text-sm font-medium">
        {copy.searchLabel}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: the picker is the page's only task
          autoFocus
          className={`${inputClass} min-h-11 pl-10`}
          placeholder={copy.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={onOtherStore}
        className="flex min-h-14 items-center gap-3 rounded-[var(--app-radius)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left hover:bg-[var(--app-surface-muted)]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--app-radius)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{copy.otherStore}</span>
          <span className="block text-sm text-[var(--app-muted)]">
            {copy.otherStoreHint}
          </span>
        </span>
      </button>

      {/* Always present, so a screen reader hears the list change as the
          person types; the visible list says the same thing to the eye. */}
      <p className="sr-only" role="status">
        {shown === undefined
          ? ''
          : shown.length === 0
            ? fmt(copy.noMatches, { query })
            : fmt(copy.matchCount, { count: shown.length })}
      </p>
      {shown === undefined ? (
        <div className="grid gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="h-14 animate-pulse rounded-[var(--app-radius)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="m-0 text-sm text-[var(--app-muted)]" aria-hidden="true">
          {fmt(copy.noMatches, { query })}
        </p>
      ) : (
        <ul className="m-0 grid list-none overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-0">
          {shown.map((retailer) => (
            <li
              key={retailer.seedKey}
              className="border-b border-[var(--app-border)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onPick(retailer)}
                className="flex min-h-14 w-full items-center gap-3 p-3 text-left hover:bg-[var(--app-surface-muted)]"
              >
                <StoreTile
                  name={retailer.name}
                  color={retailer.brandColor}
                  size="small"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {retailer.name}
                  </span>
                  <span className="block truncate text-sm text-[var(--app-muted)]">
                    {messages.loyaltyCards.categories[retailer.category]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
