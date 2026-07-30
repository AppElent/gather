import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { ImageUploadField } from '../app/ImageUploadField'
import { BabyForm } from './BabyForm'
import type { BabyNav } from './babyNav'

type BabyDetail = Doc<'babies'> & { photoUrl: string | null }

export interface EditBabyPageProps {
  babyId: string
  /** The Group the URL claims this child is in, when it names one. */
  groupSlug?: string
  nav: BabyNav
}

/** Editing a child, whole. Shared by both edit routes. */
export function EditBabyPage({ babyId, groupSlug, nav }: EditBabyPageProps) {
  const id = babyId as Id<'babies'>
  const baby = useQuery(api.babies.get, groupSlug ? { id, groupSlug } : { id })

  if (baby === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (baby === null)
    return <p className="text-sm opacity-60">Child not found.</p>

  return <EditBabyForm key={baby._id} baby={baby} nav={nav} />
}

function EditBabyForm({ baby, nav }: { baby: BabyDetail; nav: BabyNav }) {
  const update = useMutation(api.babies.update)
  const remove = useMutation(api.babies.remove)
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoId, setPhotoId] = useState<Id<'_storage'> | undefined>(
    baby.photoId,
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(baby.photoUrl)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-semibold">Edit {baby.name}</h1>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={async () => {
            if (!window.confirm(`Delete ${baby.name} and all logged entries?`))
              return
            await remove({ id: baby._id })
            navigate(nav.list)
          }}
        >
          Delete
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={photoUrl}
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
              ...values,
              sex: values.sex ?? null,
              photoId: photoId ?? null,
            })
            navigate(nav.detail(baby._id))
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not save that child',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
