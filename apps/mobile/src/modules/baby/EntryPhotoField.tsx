/**
 * The photo row of a log entry, for logging one and for editing one.
 *
 * Only Memory offers a photo today. The control is general — `photoId` is on
 * the event, not inside a Memory's payload — so the day a rash photo belongs
 * on a Note, that is one more type in `OFFERS_PHOTO`.
 */
import type { BabyEventType } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { PhotoField } from '../../components/PhotoField'
import { api } from '../../convex/api'
import { fmt, useI18n } from '../../i18n'

const OFFERS_PHOTO: readonly BabyEventType[] = ['memory']

export function EntryPhotoField({
  type,
  photoUrl,
  value,
  onChange,
  disabled,
}: {
  type: BabyEventType
  photoUrl?: string | null
  value: string | null | undefined
  onChange: (storageId: string | null) => void
  disabled: boolean
}) {
  const { t } = useI18n()
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  if (!OFFERS_PHOTO.includes(type)) return null
  const text = t.baby.log.entry
  return (
    <PhotoField
      photoUrl={photoUrl}
      value={value}
      onChange={onChange}
      generateUploadUrl={generateUploadUrl}
      labels={{
        heading: text.photo,
        take: text.takePhoto,
        choose: text.choosePhoto,
        replace: text.replacePhoto,
        remove: text.removePhoto,
        uploading: text.photoUploading,
        denied: text.photoDenied,
        failed: text.photoFailed,
        alt: fmt(text.photoOf, { type: t.baby.eventTypes[type] }),
      }}
      preset="memoryPhoto"
      disabled={disabled}
    />
  )
}
