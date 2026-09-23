import {
  type TastingAttributeValue,
  type TastingKind,
  tastingFields,
  tastingKindSpec,
} from '@gather/core/tastings'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { ImageUploadField } from '../app/ImageUploadField'
import { TastingFieldRenderer } from './TastingFieldRenderer'
import type { TastingNav } from './tastingNav'

type Attributes = Record<string, TastingAttributeValue>

export function EditTastingSubjectPage({
  kind,
  subjectId,
  groupSlug,
  nav,
}: {
  kind: TastingKind
  subjectId: string
  groupSlug: string
  nav: TastingNav
}) {
  const id = subjectId as Id<'tastingSubjects'>
  const detail = useQuery(api.tastings.getSubject, { groupSlug, id, kind })
  const messages = useMessages()
  const moduleId = tastingKindSpec(kind).moduleId
  const trail: Crumb[] = [
    { label: messages.modules.byId[moduleId].label, link: nav.list },
    ...(detail
      ? [{ label: detail.subject.name, link: nav.subject(detail.subject._id) }]
      : []),
    { label: messages.common.actions.edit },
  ]

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--app-muted)]">
          {messages.common.errors.loading}
        </p>
      </div>
    )
  }
  if (detail === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--app-muted)]">
          {messages.common.errors.notFound}
        </p>
      </div>
    )
  }

  return (
    <EditSubjectForm
      key={detail.subject._id}
      kind={kind}
      groupSlug={groupSlug}
      subject={detail.subject}
      nav={nav}
      trail={trail}
    />
  )
}

function EditSubjectForm({
  kind,
  groupSlug,
  subject,
  nav,
  trail,
}: {
  kind: TastingKind
  groupSlug: string
  subject: {
    _id: Id<'tastingSubjects'>
    name: string
    attributes: Attributes
    photoUrl: string | null
  }
  nav: TastingNav
  trail: readonly Crumb[]
}) {
  const messages = useMessages()
  const copy = messages.tastings
  const update = useMutation(api.tastings.updateSubject)
  const generateUploadUrl = useMutation(api.tastings.generateUploadUrl)
  const navigate = useNavigate()
  const [name, setName] = useState(subject.name)
  const [attributes, setAttributes] = useState<Attributes>(subject.attributes)
  const [photoUrl, setPhotoUrl] = useState(subject.photoUrl)
  const [photoId, setPhotoId] = useState<Id<'_storage'> | undefined>()
  const [photoTouched, setPhotoTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs trail={trail} />
      <h1 className="mb-6 text-2xl font-semibold">
        {copy.subject.editSubject}
      </h1>
      <ImageUploadField
        imageUrl={photoUrl}
        preset="recipePhoto"
        label={copy.subject.addPhoto}
        fieldId="tasting-subject-photo"
        generateUploadUrl={generateUploadUrl}
        onChange={(next) => {
          setPhotoTouched(true)
          setPhotoId(next)
          if (next === undefined) setPhotoUrl(null)
        }}
      />
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          setError(null)
          try {
            await update({
              groupSlug,
              id: subject._id,
              name,
              attributes: Object.fromEntries(
                Object.entries(attributes).filter(
                  ([, value]) => value !== undefined,
                ),
              ),
              ...(photoTouched ? { photoId: photoId ?? null } : {}),
            })
            navigate(nav.subject(subject._id))
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause))
            setSaving(false)
          }
        }}
      >
        <label className="grid gap-1.5 text-sm font-medium">
          <span>{copy.composer.name}</span>
          <input
            className="min-h-10 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {tastingFields(kind, 'subject').map((field) => (
          <TastingFieldRenderer
            key={field.key}
            field={field}
            value={attributes[field.key]}
            onChange={(value) =>
              setAttributes((current) => {
                if (value === undefined) {
                  const next = { ...current }
                  delete next[field.key]
                  return next
                }
                return { ...current, [field.key]: value }
              })
            }
          />
        ))}
        {error ? (
          <p role="alert" className="m-0 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="min-h-10 rounded-[var(--app-radius)] border border-[var(--app-border)] px-4 text-sm font-semibold"
            onClick={() => navigate(nav.subject(subject._id))}
          >
            {copy.composer.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-[var(--app-radius)] bg-[var(--app-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {copy.composer.saveEdit}
          </button>
        </div>
      </form>
    </div>
  )
}
