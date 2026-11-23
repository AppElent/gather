/**
 * The photo row: add one, look at it, replace it, take it off.
 *
 * Shared by the Baby log's quick-log sheet and entry screen, and by the recipe
 * form, for the reason it was shared by the first two: creating a thing with a
 * photo and correcting one must not be able to drift into two different
 * controls. Recipes is the second Module to want it, which is the bar ADR-0022
 * set for pulling a component out of the Module that happened to need it first.
 *
 * ## What the caller owns, and what this does
 *
 * The caller owns one thing: the `_storage` id (or `null`, meaning "no photo",
 * which on an edit means "remove the one that is there"). Everything else —
 * the local preview, the spinner, the permission refusal — is this component's,
 * because none of it survives a save and none of it belongs in the payload.
 *
 * The caller also owns every word. `labels` arrives already resolved and
 * already interpolated, so the Module's own tree names the thing being
 * photographed ("Photo of Sunday roast", "Photo of memory") without this
 * component ever reaching into one (ADR-0011).
 *
 * The preview is the *local* file, not the uploaded one: it is on the phone
 * already, so showing it is instant and costs no round trip. `photoUrl` is
 * what a row that was saved earlier comes back with, and it is only used when
 * there is no local file to prefer.
 *
 * ## Two buttons, not a menu
 *
 * Camera and Library are the only two answers, and a menu that holds two items
 * is a tap in front of a tap. When there is a photo they become Replace and
 * Remove, which are also two.
 */
import type { PhotoPresetName } from '@gather/core/photo-presets'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { type PhotoSource, pickPhoto, uploadPhoto } from '../photo/pickPhoto'
import { UI_ICONS } from '../theme/icons'
import { type ModuleGroup, RADIUS, TYPE, useTokens } from '../theme/tokens'

/** The local file a row shows, and whether its upload has finished. */
export interface PhotoPreview {
  uri: string
  uploaded: boolean
}

/** Every word this row can show, resolved by whichever Module is drawing it. */
export interface PhotoFieldLabels {
  /** The row's heading, shown upper-cased. */
  heading: string
  take: string
  choose: string
  replace: string
  remove: string
  uploading: string
  /** Said when a permission was refused — an answer, not a failure. */
  denied: string
  failed: string
  /** The image's accessible name, already naming its subject. */
  alt: string
}

export interface PhotoFieldProps {
  /** The URL of a photo already on this row, if it has one. */
  photoUrl?: string | null
  /**
   * `undefined` while nothing has changed, a storage id once one is picked,
   * `null` once the existing one is taken off.
   */
  value: string | null | undefined
  onChange: (storageId: string | null) => void
  /** The Module's own upload door — `recipes.generateUploadUrl` and friends. */
  generateUploadUrl: () => Promise<string>
  /** How the photo is prepared, from the one table allowed to say (ADR-0010). */
  preset: PhotoPresetName
  labels: PhotoFieldLabels
  /** The Module's tint, so the row belongs to the screen it is on (ADR-0017). */
  group?: ModuleGroup
  disabled?: boolean
  /**
   * Told when an upload starts and ends, so a form can hold its Save until the
   * photo it shows is the photo it sends.
   */
  onBusyChange?: (busy: boolean) => void
  /**
   * A preview to open on: a form reopened on a kept draft. One whose upload had
   * not finished is uploaded again.
   */
  initialPreview?: PhotoPreview | null
  /** Told what the row shows of a local file, for a form that keeps a draft. */
  onPreviewChange?: (preview: PhotoPreview | null) => void
  /** Prefix for the controls' `testID`s, so a verification run can reach them. */
  testID?: string
}

export function PhotoField({
  photoUrl,
  value,
  onChange,
  generateUploadUrl,
  preset,
  labels,
  group = 'home',
  disabled,
  onBusyChange,
  initialPreview,
  onPreviewChange,
  testID,
}: PhotoFieldProps) {
  const tokens = useTokens(group)

  const [preview, setPreview] = useState<string | null>(
    initialPreview?.uri ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // `value === null` is an explicit removal and beats whatever is stored.
  const shown = value === null ? null : (preview ?? photoUrl ?? null)

  const mounted = useRef(true)
  // Told when an upload's row goes: the next row uploads the kept preview
  // itself, and this upload, landing late, must not replace that one's photo.
  // A form that keeps no preview still gets its photo.
  const stale = () => !mounted.current && onPreviewChange !== undefined

  async function choose(source: PhotoSource) {
    setProblem(null)
    const picked = await pickPhoto(source, preset).catch(
      () => 'failed' as const,
    )
    if (picked === null) return
    if (picked === 'denied') {
      setProblem(labels.denied)
      return
    }
    if (picked === 'failed') {
      setProblem(labels.failed)
      return
    }

    await upload(picked.uri)
  }

  async function upload(uri: string) {
    if (stale()) return
    // Shown before it is uploaded: the file is already on the phone, and a
    // second of blank space while the bytes go up reads as nothing happening.
    setPreview(uri)
    onPreviewChange?.({ uri, uploaded: false })
    setBusy(true)
    onBusyChange?.(true)
    try {
      const storageId = await uploadPhoto(uri, await generateUploadUrl())
      if (stale()) return
      onChange(storageId)
      onPreviewChange?.({ uri, uploaded: true })
    } catch {
      if (stale()) return
      setPreview(null)
      onPreviewChange?.(null)
      setProblem(labels.failed)
    } finally {
      if (!stale()) {
        setBusy(false)
        onBusyChange?.(false)
      }
    }
  }

  // A kept draft whose upload had not finished: finish it, once.
  const unfinished = useRef(
    initialPreview && !initialPreview.uploaded ? initialPreview.uri : null,
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only
  useEffect(() => {
    const uri = unfinished.current
    unfinished.current = null
    mounted.current = true
    if (uri) void upload(uri)
    return () => {
      mounted.current = false
      // Its upload no longer answers, so it holds the form no longer.
      if (stale()) onBusyChange?.(false)
    }
  }, [])

  function remove() {
    setPreview(null)
    onPreviewChange?.(null)
    setProblem(null)
    onChange(null)
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.muted }]}>
        {labels.heading}
      </Text>

      {shown ? (
        <Image
          source={{ uri: shown }}
          style={[styles.preview, { backgroundColor: tokens.surface2 }]}
          contentFit="cover"
          accessibilityLabel={labels.alt}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.actions}>
        {shown ? (
          <>
            <PhotoButton
              label={labels.replace}
              group={group}
              testID={testID && `${testID}-replace`}
              disabled={disabled || busy}
              onPress={() => choose('library')}
            />
            <PhotoButton
              label={labels.remove}
              tone="danger"
              group={group}
              testID={testID && `${testID}-remove`}
              disabled={disabled || busy}
              onPress={remove}
            />
          </>
        ) : (
          <>
            <PhotoButton
              label={labels.take}
              icon="Camera"
              group={group}
              testID={testID && `${testID}-camera`}
              disabled={disabled || busy}
              onPress={() => choose('camera')}
            />
            <PhotoButton
              label={labels.choose}
              icon="ImagePlus"
              group={group}
              testID={testID && `${testID}-library`}
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
            {labels.uploading}
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
  group,
  disabled,
  testID,
  onPress,
}: {
  label: string
  icon?: 'Camera' | 'ImagePlus'
  tone?: 'danger'
  group: ModuleGroup
  disabled?: boolean
  testID?: string
  onPress: () => void
}) {
  const tokens = useTokens(group)
  const Icon = icon ? UI_ICONS[icon] : null
  const color = tone === 'danger' ? tokens.danger : tokens.ink

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: tokens.hair, backgroundColor: tokens.ground },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {Icon ? <Icon size={16} color={color} strokeWidth={1.9} /> : null}
      <Text style={[styles.buttonText, { color }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { ...TYPE.footnoteStrong },
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
    borderRadius: RADIUS.pill,
  },
  buttonText: { ...TYPE.bodyStrong, flexShrink: 1, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { ...TYPE.footnote },
  pressed: { opacity: 0.6 },
})
