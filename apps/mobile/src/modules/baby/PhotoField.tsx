/**
 * The photo row: add one, look at it, replace it, take it off.
 *
 * Shared by the quick-log sheet and the entry screen for the same reason
 * `EntryFields` is — creating a Memory and correcting one must not be able to
 * drift into two different controls.
 *
 * ## Why the state lives here and the id lives above
 *
 * The parent owns one thing: the `_storage` id (or `null`, meaning "no
 * photo", which on an edit means "remove the one that is there"). Everything
 * else — the local preview, the spinner, the permission refusal — is this
 * component's, because none of it survives a save and none of it belongs in
 * the payload.
 *
 * The preview is the *local* file, not the uploaded one: it is on the phone
 * already, so showing it is instant and costs no round trip. `photoUrl` is
 * what an entry that was saved earlier comes back with, and it is only used
 * when there is no local file to prefer.
 *
 * ## Two buttons, not a menu
 *
 * Camera and Library are the only two answers, and a menu that holds two
 * items is a tap in front of a tap. When there is a photo they become
 * Replace and Remove, which are also two.
 */
import { Image } from 'expo-image'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { BABY_UI_ICONS } from './icons'
import { type PhotoSource, pickPhoto, uploadPhoto } from './photo'

export interface PhotoFieldProps {
  /** The URL of a photo already on this entry, if it has one. */
  photoUrl?: string | null
  /**
   * `undefined` while nothing has changed, a storage id once one is picked,
   * `null` once the existing one is taken off.
   */
  value: string | null | undefined
  onChange: (storageId: string | null) => void
  /** `babies.generateUploadUrl` — the Baby module's upload door. */
  generateUploadUrl: () => Promise<string>
  /** For the image's alt text: which kind of entry this is. */
  typeLabel: string
  disabled?: boolean
}

export function PhotoField({
  photoUrl,
  value,
  onChange,
  generateUploadUrl,
  typeLabel,
  disabled,
}: PhotoFieldProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const text = t.baby.log.entry

  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // `value === null` is an explicit removal and beats whatever is stored.
  const shown = value === null ? null : (preview ?? photoUrl ?? null)

  async function choose(source: PhotoSource) {
    setProblem(null)
    const picked = await pickPhoto(source).catch(() => 'failed' as const)
    if (picked === null) return
    if (picked === 'denied') {
      setProblem(text.photoDenied)
      return
    }
    if (picked === 'failed') {
      setProblem(text.photoFailed)
      return
    }

    // Shown before it is uploaded: the file is already on the phone, and a
    // second of blank space while the bytes go up reads as nothing happening.
    setPreview(picked.uri)
    setBusy(true)
    try {
      const storageId = await uploadPhoto(picked.uri, await generateUploadUrl())
      onChange(storageId)
    } catch {
      setPreview(null)
      setProblem(text.photoFailed)
    } finally {
      setBusy(false)
    }
  }

  function remove() {
    setPreview(null)
    setProblem(null)
    onChange(null)
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.muted }]}>
        {text.photo.toUpperCase()}
      </Text>

      {shown ? (
        <Image
          source={{ uri: shown }}
          style={[styles.preview, { backgroundColor: tokens.tile }]}
          contentFit="cover"
          accessibilityLabel={fmt(text.photoOf, { type: typeLabel })}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.actions}>
        {shown ? (
          <>
            <PhotoButton
              label={text.replacePhoto}
              disabled={disabled || busy}
              onPress={() => choose('library')}
            />
            <PhotoButton
              label={text.removePhoto}
              tone="danger"
              disabled={disabled || busy}
              onPress={remove}
            />
          </>
        ) : (
          <>
            <PhotoButton
              label={text.takePhoto}
              icon="Camera"
              disabled={disabled || busy}
              onPress={() => choose('camera')}
            />
            <PhotoButton
              label={text.choosePhoto}
              icon="ImagePlus"
              disabled={disabled || busy}
              onPress={() => choose('library')}
            />
          </>
        )}
      </View>

      {busy ? (
        <View style={styles.status}>
          <ActivityIndicator color={tokens.muted} size="small" />
          <Text style={[styles.statusText, { color: tokens.muted }]}>
            {text.photoUploading}
          </Text>
        </View>
      ) : null}

      {problem ? (
        <Text style={[styles.statusText, { color: tokens.danger }]}>
          {problem}
        </Text>
      ) : null}
    </View>
  )
}

function PhotoButton({
  label,
  icon,
  tone,
  disabled,
  onPress,
}: {
  label: string
  icon?: 'Camera' | 'ImagePlus'
  tone?: 'danger'
  disabled?: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const Icon = icon ? BABY_UI_ICONS[icon] : null
  const color = tone === 'danger' ? tokens.danger : tokens.fg

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: tokens.border, backgroundColor: tokens.bg },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {Icon ? <Icon size={16} color={color} strokeWidth={1.9} /> : null}
      <Text numberOfLines={1} style={[styles.buttonText, { color }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.card,
  },
  actions: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
})
