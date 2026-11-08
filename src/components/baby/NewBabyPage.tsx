import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { ImageUploadField } from '../app/ImageUploadField'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { BabyForm, type BabyFormValues } from './BabyForm'

/** Adding a child to the Current Group, whole. */
export function NewBabyPage() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const create = useMutation(api.babies.create)
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoId, setPhotoId] = useState<Id<'_storage'> | undefined>()
  const messages = useMessages()
  const { form } = messages.baby.log

  /** Baby log → Add a child. */
  const trail: Crumb[] = [
    { label: messages.modules.byId['baby-log'].label, link: linkTo('baby-log') },
    { label: form.createTitle },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs trail={trail} />
      <h1 className="mb-6 text-2xl font-semibold">{form.createTitle}</h1>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={null}
        preset="childPhoto"
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
            const id = await create({ ...values, photoId, groupSlug })
            navigate(linkTo('child', { babyId: id }))
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : form.saveFailed
                : err instanceof Error
                  ? err.message
                  : form.saveFailed,
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
