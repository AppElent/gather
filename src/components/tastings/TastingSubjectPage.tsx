import {
  type TastingAttributes,
  type TastingFieldScope,
  type TastingKind,
  tastingFields,
  tastingKindSpec,
} from '@gather/core/tastings'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n, useMessages } from '../../lib/i18n'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { type EditableTasting, TastingDialog } from './TastingDialog'
import { TASTING_LINKS } from './tastingNav'
import { tastingFieldValue } from './tastingText'

export function TastingSubjectPage({
  kind,
  subjectId,
}: {
  kind: TastingKind
  subjectId: string
}) {
  const { slug: groupSlug, name: groupName } = useRequiredCurrentGroup()
  const nav = TASTING_LINKS[kind]
  const id = subjectId as Id<'tastingSubjects'>
  const detail = useQuery(api.tastings.getSubject, { groupSlug, id, kind })
  const removeTasting = useMutation(api.tastings.removeTasting)
  const removeSubject = useMutation(api.tastings.removeSubject)
  const navigate = useNavigate()
  const messages = useMessages()
  const { locale } = useI18n()
  const copy = messages.tastings
  const moduleId = tastingKindSpec(kind).moduleId
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<EditableTasting | null>(null)
  const { confirm, dialog } = useConfirmAction()
  const trail: Crumb[] = [
    { label: messages.modules.byId[moduleId].label, link: nav.list },
    ...(detail ? [{ label: detail.subject.name }] : []),
  ]

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--app-muted)]">
          {messages.common.errors.loading}
        </p>
      </div>
    )
  }
  if (detail === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--app-muted)]">
          {messages.common.errors.notFound}
        </p>
      </div>
    )
  }

  const { subject, tastings } = detail
  const dialogSubject = {
    subjectId: subject._id,
    name: subject.name,
    attributes: subject.attributes,
  }

  return (
    <article className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={trail} className="mb-0" />
      {subject.photoUrl ? (
        <img
          src={subject.photoUrl}
          alt={fmt(copy.subject.photoOf, { name: subject.name })}
          className="max-h-80 w-full rounded-[var(--app-radius)] object-cover"
        />
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">{subject.name}</h1>
          {subject.average === null ? (
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              {copy.index.noScore}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              <strong className="text-[var(--app-fg)]">
                {subject.average.toFixed(1)} ★
              </strong>{' '}
              {fmt(copy.index.fromCount, { count: subject.count })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={copy.subject.logTasting}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
            onClick={() => setLogging(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{copy.subject.logTasting}</span>
          </button>
          <Link
            {...nav.edit(subject._id)}
            aria-label={copy.subject.editSubject}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] text-inherit no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{copy.subject.editSubject}</span>
          </Link>
          <button
            type="button"
            aria-label={copy.subject.delete}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-red-300 text-red-700 lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
            onClick={() =>
              confirm({
                title: fmt(copy.subject.deleteSubjectTitle, {
                  name: subject.name,
                }),
                body:
                  subject.count === 0
                    ? copy.subject.deleteSubjectBodyEmpty
                    : plural(
                        locale,
                        subject.count,
                        copy.subject.deleteSubjectBody,
                      ),
                confirmLabel: copy.subject.delete,
                run: async () => {
                  await removeSubject({ groupSlug, id: subject._id })
                  navigate(nav.list)
                },
              })
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{copy.subject.delete}</span>
          </button>
        </div>
      </header>

      <SurfaceCard>
        <h2 className="mt-0 text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)]">
          {copy.subject.facts}
        </h2>
        <Facts
          kind={kind}
          scope="subject"
          attributes={subject.attributes}
          className="m-0"
        />
      </SurfaceCard>

      <section>
        <h2 className="text-lg font-semibold">{copy.subject.tastings}</h2>
        {tastings.length === 0 ? (
          <SurfaceCard>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {copy.subject.noTastings}
            </p>
          </SurfaceCard>
        ) : (
          <div className="grid gap-3">
            {tastings.map((tasting) => (
              <SurfaceCard key={tasting._id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 font-semibold">
                      {tasting.mine ? copy.subject.you : (tasting.byName ?? '')}
                      <span className="ml-2 text-sm font-normal text-[var(--app-muted)]">
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeZone: 'UTC',
                        }).format(new Date(`${tasting.tastedAt}T00:00:00Z`))}
                      </span>
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {tasting.rating.toFixed(1)} ★
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {tasting.mine ? (
                      <button
                        type="button"
                        aria-label={copy.subject.edit}
                        className="grid min-h-9 min-w-9 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)]"
                        onClick={() =>
                          setEditing({
                            id: tasting._id,
                            rating: tasting.rating,
                            tastedAt: tasting.tastedAt,
                            attributes: tasting.attributes,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={copy.subject.deleteTasting}
                      className="grid min-h-9 min-w-9 place-items-center rounded-[var(--app-radius)] border border-red-300 text-red-700"
                      onClick={() =>
                        confirm({
                          title: copy.subject.deleteTastingTitle,
                          body: copy.subject.deleteTastingBody,
                          confirmLabel: copy.subject.delete,
                          run: () =>
                            removeTasting({ groupSlug, id: tasting._id }),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <Facts
                  kind={kind}
                  scope="tasting"
                  attributes={tasting.attributes}
                  className="mb-0 mt-3"
                />
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <TastingDialog
        key={logging ? 'log-open' : 'log-closed'}
        open={logging}
        kind={kind}
        groupSlug={groupSlug}
        groupName={groupName}
        subject={dialogSubject}
        onClose={() => setLogging(false)}
      />
      <TastingDialog
        key={editing?.id ?? 'edit-closed'}
        open={editing !== null}
        kind={kind}
        groupSlug={groupSlug}
        groupName={groupName}
        subject={dialogSubject}
        tasting={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
      {dialog}
    </article>
  )
}

/** The filled-in fields of a subject or a tasting, as label and value. */
function Facts({
  kind,
  scope,
  attributes,
  className,
}: {
  kind: TastingKind
  scope: TastingFieldScope
  attributes: TastingAttributes
  className: string
}) {
  const messages = useMessages()
  return (
    <dl className={`${className} grid gap-3 sm:grid-cols-2`}>
      {tastingFields(kind, scope).map((field) => {
        const value = attributes[field.key]
        if (value === undefined) return null
        return (
          <div key={field.key}>
            <dt className="text-xs font-semibold text-[var(--app-muted)]">
              {
                messages.tastings.fields[
                  field.key as keyof typeof messages.tastings.fields
                ]
              }
            </dt>
            <dd className="m-0 mt-1 text-sm">
              {tastingFieldValue(messages, field, value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
