import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { ImageUploadField } from '../app/ImageUploadField'
import { BabyForm } from './BabyForm'
import type { BabyNav } from './babyNav'

type BabyDetail = Doc<'babies'> & { photoUrl: string | null }

export interface EditBabyPageProps {
  babyId: string
  /** The Group the URL claims this child is in. */
  groupSlug: string
  nav: BabyNav
}

/** Editing a child, whole. */
export function EditBabyPage({ babyId, groupSlug, nav }: EditBabyPageProps) {
  const id = babyId as Id<'babies'>
  const baby = useQuery(api.babies.get, { id, groupSlug })
  const messages = useMessages()

  if (baby === undefined)
    return (
      <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
    )
  if (baby === null)
    return (
      <p className="text-sm opacity-60">{messages.baby.log.child.notFound}</p>
    )

  return (
    <EditBabyForm key={baby._id} baby={baby} groupSlug={groupSlug} nav={nav} />
  )
}

function EditBabyForm({
  baby,
  groupSlug,
  nav,
}: {
  baby: BabyDetail
  groupSlug: string
  nav: BabyNav
}) {
  const update = useMutation(api.babies.update)
  const remove = useMutation(api.babies.remove)
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmAction()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoId, setPhotoId] = useState<Id<'_storage'> | undefined>(
    baby.photoId,
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(baby.photoUrl)
  const messages = useMessages()
  const { form } = messages.baby.log

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-semibold">
          {fmt(form.editTitle, { name: baby.name })}
        </h1>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() =>
            confirm({
              title: fmt(form.deleteTitle, { name: baby.name }),
              body: form.deleteBody,
              confirmLabel: fmt(form.deleteConfirm, { name: baby.name }),
              errorFallback: form.deleteFailed,
              run: async () => {
                await remove({ id: baby._id, groupSlug })
                navigate(nav.list)
              },
            })
          }
        >
          {messages.common.actions.delete}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={photoUrl}
        preset="childPhoto"
        generateUploadUrl={generateUploadUrl}
        fieldId="baby-photo-upload"
        onChange={(id) => {
          setPhotoId(id)
          if (id === undefined) setPhotoUrl(null)
        }}
      />

      <BabyForm
        submitting={submitting}
        initial={{
          name: baby.name,
          birthDate: baby.birthDate,
          sex: baby.sex,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({
              id: baby._id,
              groupSlug,
              ...values,
              sex: values.sex ?? null,
              photoId: photoId ?? null,
            })
            navigate(nav.detail(baby._id))
          } catch (err) {
            setError(err instanceof Error ? err.message : form.saveFailed)
            setSubmitting(false)
          }
        }}
      />

      {dialog}
    </div>
  )
}
