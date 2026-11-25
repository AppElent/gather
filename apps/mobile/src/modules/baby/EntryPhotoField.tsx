/**
 * The photo row of a log entry, for logging one and for editing one.
 *
 * `offersPhoto` decides which types show it.
 */
import { offersPhoto } from '@gather/core/baby-events'
import type { BabyEventType } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { PhotoField, type PhotoFieldProps } from '../../components/PhotoField'
import { api } from '../../convex/api'
import { fmt, useI18n } from '../../i18n'

export function EntryPhotoField({
  type,
  photoUrl,
  value,
  onChange,
  disabled,
  ...rest
}: {
  type: BabyEventType
  photoUrl?: string | null
  value: string | null | undefined
  onChange: (storageId: string | null) => void
  disabled: boolean
} & Pick<
  PhotoFieldProps,
  'initialPreview' | 'onPreviewChange' | 'onBusyChange' | 'uploadScope'
>) {
  const { t } = useI18n()
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  if (!offersPhoto(type)) return null
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
      {...rest}
    />
  )
}
