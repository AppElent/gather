import {
  TASTING_RATING,
  type TastingAttributes,
  type TastingAttributeValue,
  type TastingKind,
  tastingFields,
} from '@gather/core/tastings'
import { useMutation, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { TastingFieldRenderer } from './TastingFieldRenderer'

type Attributes = Record<string, TastingAttributeValue>

interface SubjectChoice {
  subjectId?: Id<'tastingSubjects'>
  name: string
  attributes: Attributes
  catalogKey?: string
  count?: number
}

export interface EditableTasting {
  id: Id<'tastings'>
  rating: number
  tastedAt: string
  attributes: TastingAttributes
}

interface TastingDialogProps {
  open: boolean
  kind: TastingKind
  groupSlug: string
  groupName: string
  subject?: SubjectChoice
  tasting?: EditableTasting
  onClose: () => void
  onSaved?: (subjectId: Id<'tastingSubjects'>) => void
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function TastingDialog({
  open,
  kind,
  groupSlug,
  groupName,
  subject: initialSubject,
  tasting,
  onClose,
  onSaved,
}: TastingDialogProps) {
  const messages = useMessages()
  const copy = messages.tastings
  const words = copy.kinds[kind]
  const subjects = useQuery(
    api.tastings.listByKind,
    open && !initialSubject ? { groupSlug, kind } : 'skip',
  )
  const catalog = useQuery(
    api.tastings.catalogByKind,
    open && !initialSubject ? { kind } : 'skip',
  )
  const log = useMutation(api.tastings.logTasting)
  const update = useMutation(api.tastings.updateTasting)
  const [step, setStep] = useState<'pick' | 'compose'>(
    initialSubject ? 'compose' : 'pick',
  )
  const [query, setQuery] = useState('')
  const [choice, setChoice] = useState<SubjectChoice | undefined>(
    initialSubject,
  )
  const [subjectAttributes, setSubjectAttributes] = useState<Attributes>(
    initialSubject?.attributes ?? {},
  )
  const [rating, setRating] = useState(tasting?.rating ?? 3)
  const [tastedAt, setTastedAt] = useState(tasting?.tastedAt ?? today())
  const [attributes, setAttributes] = useState<Attributes>(
    (tasting?.attributes as Attributes) ?? {},
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needle = query.trim().toLocaleLowerCase()
  const matchingSubjects = useMemo(
    () =>
      (subjects ?? []).filter(
        (entry) => !needle || entry.name.toLocaleLowerCase().includes(needle),
      ),
    [subjects, needle],
  )
  const matchingCatalog = useMemo(
    () =>
      (catalog ?? []).filter(
        (entry) => !needle || entry.name.toLocaleLowerCase().includes(needle),
      ),
    [catalog, needle],
  )
  const exactDuplicate = (subjects ?? []).find(
    (entry) => entry.name.toLocaleLowerCase() === needle,
  )

  if (!open) return null

  const choose = (next: SubjectChoice) => {
    setChoice(next)
    setSubjectAttributes(next.attributes)
    setStep('compose')
    setError(null)
  }

  const setAttribute = (
    setter: React.Dispatch<React.SetStateAction<Attributes>>,
    key: string,
    value: TastingAttributeValue | undefined,
  ) =>
    setter((current) => {
      if (value === undefined) {
        const next = { ...current }
        delete next[key]
        return next
      }
      return { ...current, [key]: value }
    })

  const clean = (values: Attributes) =>
    Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    )

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasting-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl"
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="tasting-dialog-title" className="m-0 text-xl font-semibold">
              {step === 'pick'
                ? fmt(copy.picker.title, { kind: words.one })
                : tasting
                  ? copy.subject.edit
                  : words.newTasting}
            </h2>
            {step === 'compose' && choice ? (
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                {choice.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={copy.composer.cancel}
            className="grid min-h-10 min-w-10 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {step === 'pick' ? (
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>{copy.picker.search}</span>
              <input
                autoFocus
                className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {exactDuplicate && query.trim() ? (
              <p className="m-0 rounded-[var(--app-radius)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                {fmt(copy.picker.duplicate, { name: exactDuplicate.name })}
              </p>
            ) : null}
            {matchingSubjects.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="m-0 text-sm font-semibold">
                  {fmt(copy.picker.mine, { group: groupName })}
                </h3>
                {matchingSubjects.map((entry) => (
                  <button
                    key={entry._id}
                    type="button"
                    className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3 text-left hover:bg-[var(--app-surface-muted)]"
                    onClick={() =>
                      choose({
                        subjectId: entry._id,
                        name: entry.name,
                        attributes: entry.attributes as Attributes,
                        count: entry.count,
                      })
                    }
                  >
                    <span className="font-semibold">{entry.name}</span>
                    <span className="ml-2 text-xs text-[var(--app-muted)]">
                      {entry.count === 1
                        ? fmt(copy.composer.existing, { count: entry.count })
                        : fmt(copy.composer.existingOther, {
                            count: entry.count,
                          })}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {matchingCatalog.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="m-0 text-sm font-semibold">
                  {words.catalogHeading}
                </h3>
                {matchingCatalog.map((entry) => (
                  <button
                    key={entry.seedKey}
                    type="button"
                    className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3 text-left hover:bg-[var(--app-surface-muted)]"
                    onClick={() =>
                      choose({
                        name: entry.name,
                        attributes: entry.attributes as Attributes,
                        catalogKey: entry.seedKey,
                      })
                    }
                  >
                    <span className="font-semibold">{entry.name}</span>
                    <span className="ml-2 text-xs text-[var(--app-muted)]">
                      {copy.composer.fromCatalog}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {query.trim() ? (
              <button
                type="button"
                className="rounded-[var(--app-radius)] border border-dashed border-[var(--app-border)] p-3 text-left"
                onClick={() => choose({ name: query.trim(), attributes: {} })}
              >
                <span className="block font-semibold">
                  {fmt(copy.picker.create, { name: query.trim() })}
                </span>
                <span className="text-xs text-[var(--app-muted)]">
                  {fmt(copy.picker.createHint, { kind: words.one })}
                </span>
              </button>
            ) : null}
          </div>
        ) : choice ? (
          <form
            className="grid gap-5"
            onSubmit={async (event) => {
              event.preventDefault()
              setSaving(true)
              setError(null)
              try {
                if (tasting) {
                  await update({
                    groupSlug,
                    id: tasting.id,
                    rating,
                    tastedAt,
                    attributes: clean(attributes),
                  })
                  onSaved?.(choice.subjectId as Id<'tastingSubjects'>)
                } else {
                  const result = await log({
                    groupSlug,
                    kind,
                    subject: choice.subjectId
                      ? { subjectId: choice.subjectId }
                      : {
                          name: choice.name,
                          attributes: clean(subjectAttributes),
                          catalogKey: choice.catalogKey,
                        },
                    rating,
                    tastedAt,
                    attributes: clean(attributes),
                  })
                  onSaved?.(result.subjectId)
                }
                onClose()
              } catch (cause) {
                const key = cause instanceof Error ? cause.message : ''
                setError(
                  copy.composer.problems[
                    key as keyof typeof copy.composer.problems
                  ] ??
                    key ??
                    messages.common.errors.somethingWentWrong,
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            {!choice.subjectId && !tasting ? (
              <fieldset className="grid gap-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-4">
                <legend className="px-1 text-sm font-semibold">
                  {words.facts}
                </legend>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>{copy.composer.name}</span>
                  <input
                    className="min-h-10 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
                    value={choice.name}
                    onChange={(event) =>
                      setChoice({ ...choice, name: event.target.value })
                    }
                  />
                </label>
                {tastingFields(kind, 'subject').map((field) => (
                  <TastingFieldRenderer
                    key={field.key}
                    field={field}
                    value={subjectAttributes[field.key]}
                    onChange={(value) =>
                      setAttribute(setSubjectAttributes, field.key, value)
                    }
                  />
                ))}
              </fieldset>
            ) : null}
            <fieldset className="grid gap-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-4">
              <legend className="px-1 text-sm font-semibold">
                {copy.composer.myTasting}
              </legend>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>{copy.composer.score}</span>
                <div className="flex items-center gap-3">
                  <input
                    className="w-full accent-[var(--app-accent)]"
                    type="range"
                    min={TASTING_RATING.min}
                    max={TASTING_RATING.max}
                    step={TASTING_RATING.step}
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                  />
                  <output className="w-8 font-semibold">
                    {rating.toFixed(1)}
                  </output>
                </div>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>{copy.composer.tastedAt}</span>
                <input
                  className="min-h-10 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
                  type="date"
                  value={tastedAt}
                  onChange={(event) => setTastedAt(event.target.value)}
                />
              </label>
              {tastingFields(kind, 'tasting').map((field) => (
                <TastingFieldRenderer
                  key={field.key}
                  field={field}
                  value={attributes[field.key]}
                  onChange={(value) =>
                    setAttribute(setAttributes, field.key, value)
                  }
                />
              ))}
            </fieldset>
            {error ? (
              <p role="alert" className="m-0 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              {!initialSubject && !tasting ? (
                <button
                  type="button"
                  className="min-h-10 rounded-[var(--app-radius)] border border-[var(--app-border)] px-4 text-sm font-semibold"
                  onClick={() => setStep('pick')}
                >
                  {copy.picker.back}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="min-h-10 rounded-[var(--app-radius)] bg-[var(--app-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {tasting ? copy.composer.saveEdit : copy.composer.save}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}
