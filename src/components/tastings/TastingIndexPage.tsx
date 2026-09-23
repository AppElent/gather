import { type TastingKind, tastingKindSpec } from '@gather/core/tastings'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Image, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n, useMessages } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { TastingDialog } from './TastingDialog'
import type { TastingNav } from './tastingNav'
import { subjectFacts } from './tastingText'

export function TastingIndexPage({
  kind,
  groupSlug,
  groupName,
  nav,
}: {
  kind: TastingKind
  groupSlug: string
  groupName: string
  nav: TastingNav
}) {
  const messages = useMessages()
  const { locale } = useI18n()
  const copy = messages.tastings
  const words = copy.kinds[kind]
  const moduleId = tastingKindSpec(kind).moduleId
  const subjects = useQuery(api.tastings.listByKind, { groupSlug, kind })
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const needle = query.trim().toLocaleLowerCase()
  const rows = useMemo(
    () =>
      (subjects ?? []).filter(
        (subject) =>
          !needle || subject.name.toLocaleLowerCase().includes(needle),
      ),
    [subjects, needle],
  )
  const total = (subjects ?? []).reduce(
    (sum, subject) => sum + subject.count,
    0,
  )

  const addButton = (
    <button
      type="button"
      aria-label={copy.index.add}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
      onClick={() => setDialogOpen(true)}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{copy.index.add}</span>
    </button>
  )

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">
            {messages.modules.byId[moduleId].label}
          </h1>
          {subjects ? (
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              {fmt(copy.index.summary, {
                subjects: plural(
                  locale,
                  subjects.length,
                  copy.index.subjectCount,
                ),
                tastings: plural(locale, total, copy.index.tastingCount),
              })}
            </p>
          ) : null}
        </div>
        {addButton}
      </header>

      {subjects === undefined ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-20 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <SurfaceCard className="grid justify-items-center gap-3 py-10 text-center">
          <h2 className="m-0 text-lg font-semibold">
            {fmt(copy.empty.title, { kind: words.many })}
          </h2>
          <p className="m-0 max-w-lg text-sm text-[var(--app-muted)]">
            {fmt(copy.empty.body, { group: groupName })}
          </p>
          {addButton}
        </SurfaceCard>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">{copy.index.search}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]"
              aria-hidden="true"
            />
            <input
              className="min-h-11 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-10"
              type="search"
              placeholder={copy.index.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label={copy.index.clearSearch}
                className="absolute right-1 top-1/2 grid min-h-9 min-w-9 -translate-y-1/2 place-items-center"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          {rows.length === 0 ? (
            <SurfaceCard className="text-center">
              <p className="m-0 text-sm text-[var(--app-muted)]">
                {copy.index.searchEmpty}
              </p>
            </SurfaceCard>
          ) : (
            <div className="overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)]">
              {rows.map((subject) => (
                <Link
                  key={subject._id}
                  {...nav.subject(subject._id)}
                  className="flex min-h-20 items-center gap-3 border-b border-[var(--app-border)] p-3 text-inherit no-underline last:border-b-0 hover:bg-[var(--app-surface-muted)]"
                >
                  {subject.photoUrl ? (
                    <img
                      src={subject.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-[var(--app-radius)] object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--app-radius)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
                      <Image className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {subject.name}
                    </span>
                    <span className="block truncate text-sm text-[var(--app-muted)]">
                      {subjectFacts(messages, kind, subject.attributes)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {subject.average === null ? (
                      <span className="text-xs text-[var(--app-muted)]">
                        {copy.index.noScore}
                      </span>
                    ) : (
                      <>
                        <span className="block font-semibold">
                          {subject.average.toFixed(1)} ★
                        </span>
                        <span className="block text-xs text-[var(--app-muted)]">
                          {plural(
                            locale,
                            subject.count,
                            copy.index.tastingCount,
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <TastingDialog
        key={dialogOpen ? 'open' : 'closed'}
        open={dialogOpen}
        kind={kind}
        groupSlug={groupSlug}
        groupName={groupName}
        onClose={() => setDialogOpen(false)}
        onSaved={(subjectId) => navigate(nav.subject(subjectId))}
      />
    </div>
  )
}
