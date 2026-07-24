import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/app/ImageUploadField'
import {
  BabyForm,
  type BabyFormValues,
} from '../../../components/baby/BabyForm'

export const Route = createFileRoute('/_app/baby/new')({
  component: NewBaby,
})

function NewBaby() {
  const create = useMutation(api.babies.create)
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoId, setPhotoId] = useState<Id<'_storage'> | undefined>()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Add a child</h1>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={null}
        generateUploadUrl={generateUploadUrl}
        onChange={setPhotoId}
        fieldId="baby-photo-upload"
      />

      <BabyForm
        submitting={submitting}
        onSubmit={async (values: BabyFormValues) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = await create({ ...values, photoId })
            navigate({ to: '/baby/$babyId', params: { babyId: id } })
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save that child'
                : err instanceof Error
                  ? err.message
                  : 'Could not save that child',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
