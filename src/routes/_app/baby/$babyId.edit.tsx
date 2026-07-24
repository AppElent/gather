import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/app/ImageUploadField'
import { BabyForm } from '../../../components/baby/BabyForm'

export const Route = createFileRoute('/_app/baby/$babyId/edit')({
  component: EditBaby,
})

type BabyDetail = Doc<'babies'> & { photoUrl: string | null }

function EditBaby() {
  const { babyId } = Route.useParams()
  const baby = useQuery(api.babies.get, { id: babyId as Id<'babies'> })

  if (baby === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (baby === null)
    return <p className="text-sm opacity-60">Child not found.</p>

  return <EditBabyForm key={baby._id} baby={baby} />
}

function EditBabyForm({ baby }: { baby: BabyDetail }) {
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
            navigate({ to: '/baby' })
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
            navigate({ to: '/baby/$babyId', params: { babyId: baby._id } })
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
