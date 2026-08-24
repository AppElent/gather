/**
 * One entry, opened from the timeline: what was recorded, and the two things
 * you can do about it.
 *
 * ## Why this is a route rather than a sheet
 *
 * An entry has a stable address and can be opened cold. Fast in-context flows
 * use the shared native `BottomSheetModal`; this screen remains a destination.
 *
 * ## Why editing happens here rather than reopening the log sheet
 *
 * Because the alternative is a modal on top of a modal, and because "look at
 * this entry" and "fix this entry" are the same subject. The rows themselves
 * are `EntryFields`, shared with the quick-log sheet, so a field added to one
 * is a field added to both.
 *
 * Delete asks first, with the platform's own alert. It is the one action in the
 * Module with nothing behind it — a deleted entry is gone for everyone in the
 * Group — and an undo toast on a record somebody may show a doctor is not good
 * enough.
 */
import type { BabyEventType } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { PhotoField } from '../../components/PhotoField'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { DateTimeField } from './DateTimeField'
import { EntryFields, fieldLabel, optionText } from './EntryFields'
import { EVENT_ICONS } from './icons'
import {
  buildSheetData,
  editPicks,
  endTimestampFor,
  fieldsFor,
  missingRequired,
  outOfRangeFields,
} from './sheetFields'
import { useBabyLog } from './useBabyLog'

export function EntryScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const log = useBabyLog()

  const update = useMutation(api.babyEvents.update)
  const remove = useMutation(api.babyEvents.remove)
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)

  const { entryId } = useLocalSearchParams<{ entryId?: string }>()
  const entry = useMemo(
    () => (log.events ?? []).find((each) => each._id === entryId),
    [log.events, entryId],
  )

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Seeded lazily from the entry, and only once: re-deriving them on every
  // render would throw away every keystroke as it was typed.
  const [picks, setPicks] = useState<Record<string, string> | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<number | null>(null)
  const [whenOpen, setWhenOpen] = useState(false)
  // `undefined` until the picture is touched, so an edit that never went near
  // it sends nothing and the mutation leaves the stored one alone.
  const [photoId, setPhotoId] = useState<string | null | undefined>(undefined)

  const tint = tokens.tintOf('home')

  if (log.events === undefined) {
    return (
      <View style={[styles.centre, { backgroundColor: tokens.surface }]}>
        <ActivityIndicator color={tokens.muted} />
      </View>
    )
  }

  if (!entry) {
    // Deleted from another device while this was open, or a stale deep link.
    return (
      <View style={[styles.centre, { backgroundColor: tokens.surface }]}>
        <Text style={{ color: tokens.muted }}>{t.baby.log.timeline.gone}</Text>
      </View>
    )
  }

  const type = entry.type as BabyEventType
  const Icon = EVENT_ICONS[type]
  const labels = t.baby.log.fields as Record<string, string>
  const when = new Date(entry.timestamp)

  function beginEditing() {
    if (!entry) return
    setPicks(editPicks(type, entry))
    setNotes(entry.notes ?? '')
    setTimestamp(entry.timestamp)
    setPhotoId(undefined)
    setFailure(null)
    setEditing(true)
  }

  const draft = picks ?? {}
  const draftTime = timestamp ?? entry.timestamp
  const rejected = editing ? outOfRangeFields(type, draft) : []
  const missing = editing ? missingRequired(type, draft) : null
  const blocked = rejected.length > 0 || missing !== null

  async function save() {
    if (!entry || blocked) return
    setBusy(true)
    setFailure(null)
    try {
      await update({
        eventId: entry._id as Id<'babyEvents'>,
        groupSlug: log.groupSlug,
        timestamp: draftTime,
        // `null` rather than `undefined`: the mutation reads undefined as
        // "leave it alone" and null as "clear it", and a sleep whose duration
        // was edited down to nothing has to actually lose its end.
        endTimestamp: endTimestampFor(type, draft, draftTime) ?? null,
        notes: notes?.trim() || null,
        photoId: photoId as Id<'_storage'> | null | undefined,
        data: buildSheetData(type, draft) as never,
      })
      haptics.itemSaved()
      setEditing(false)
    } catch {
      haptics.actionFailed()
      setFailure(t.baby.log.entry.saveFailed)
    }
    setBusy(false)
  }

  function confirmDelete() {
    if (!entry) return
    Alert.alert(
      t.baby.log.timeline.deleteTitle,
      fmt(t.baby.log.timeline.deleteEntry, { type: t.baby.eventTypes[type] }),
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.baby.log.timeline.deleteConfirm,
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              await remove({
                eventId: entry._id as Id<'babyEvents'>,
                groupSlug: log.groupSlug,
              })
              router.back()
            } catch {
              haptics.actionFailed()
              setFailure(t.baby.log.timeline.deleteFailed)
              setBusy(false)
            }
          },
        },
      ],
    )
  }

  /** The read view: every row this type has, with the value it holds. */
  function summary() {
    const stored = editPicks(type, entry as NonNullable<typeof entry>)
    const rows = fieldsFor(type, stored)
      .map((field) => {
        const raw = stored[field.key] ?? ''
        if (!raw || raw === '0') return null
        const value =
          field.input === 'chips'
            ? optionText(type, field.key, raw, t.baby.log.options)
            : field.unit
              ? `${raw} ${field.unit}`
              : raw
        return { key: field.key, name: fieldLabel(labels, field), value }
      })
      .filter((row) => row !== null)

    if (rows.length === 0) return null
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.bg, borderColor: tokens.border },
        ]}
      >
        {rows.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.detail,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: tokens.border,
              },
            ]}
          >
            <Text style={[styles.detailName, { color: tokens.muted }]}>
              {row.name}
            </Text>
            <Text style={[styles.detailValue, { color: tokens.fg }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: editing
            ? fmt(t.baby.log.entry.editTitle, { type: t.baby.eventTypes[type] })
            : t.baby.eventTypes[type],
        }}
      />
      <ScrollView
        style={{ backgroundColor: tokens.surface }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Not a title — the bar above already carries the event type, and
            repeating it under the bar is what made this read as a screen
            wearing a sheet. What is left is the one fact the bar cannot hold:
            when. Editing replaces it with the control that changes it. */}
        {editing ? null : (
          <View style={styles.head}>
            <View style={[styles.glyph, { backgroundColor: tint.bg }]}>
              <Icon size={20} color={tint.fg} strokeWidth={1.9} />
            </View>
            <Text style={[styles.when, { color: tokens.muted }]}>
              {when.toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {' · '}
              {when.toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {editing ? (
          <>
            <DateTimeField
              value={draftTime}
              onChange={setTimestamp}
              now={entry.timestamp}
              open={whenOpen}
              onToggle={() => setWhenOpen((was) => !was)}
            />
            <EntryFields
              type={type}
              picks={draft}
              onChange={(key, value) =>
                setPicks((prev) => ({ ...(prev ?? {}), [key]: value }))
              }
            />
            <TextInput
              value={notes ?? ''}
              onChangeText={setNotes}
              placeholder={t.baby.log.entry.notes}
              placeholderTextColor={tokens.muted}
              multiline
              accessibilityLabel={t.baby.log.entry.notes}
              style={[
                styles.notes,
                {
                  borderColor: tokens.border,
                  backgroundColor: tokens.bg,
                  color: tokens.fg,
                },
              ]}
            />

            {type === 'memory' ? (
              <PhotoField
                photoUrl={entry.photoUrl}
                value={photoId}
                onChange={setPhotoId}
                generateUploadUrl={generateUploadUrl}
                labels={{
                  heading: t.baby.log.entry.photo,
                  take: t.baby.log.entry.takePhoto,
                  choose: t.baby.log.entry.choosePhoto,
                  replace: t.baby.log.entry.replacePhoto,
                  remove: t.baby.log.entry.removePhoto,
                  uploading: t.baby.log.entry.photoUploading,
                  denied: t.baby.log.entry.photoDenied,
                  failed: t.baby.log.entry.photoFailed,
                  alt: fmt(t.baby.log.entry.photoOf, {
                    type: t.baby.eventTypes[type],
                  }),
                }}
                preset="memoryPhoto"
                disabled={busy}
              />
            ) : null}

            {missing ? (
              <Text style={[styles.error, { color: tokens.danger }]}>
                {t.baby.log.validation[missing]}
              </Text>
            ) : null}

            {rejected.map((field) => (
              <Text
                key={field.key}
                style={[styles.error, { color: tokens.danger }]}
              >
                {fmt(t.baby.log.validation.outOfRange, {
                  field: fieldLabel(labels, field),
                  min: field.min ?? 0,
                  max: field.max ?? 0,
                })}
              </Text>
            ))}
          </>
        ) : (
          <>
            {summary()}
            {entry.notes ? (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
                  {t.baby.log.entry.notes.toUpperCase()}
                </Text>
                <Text style={[styles.notesRead, { color: tokens.fg }]}>
                  {entry.notes}
                </Text>
              </View>
            ) : null}
            {entry.photoUrl ? (
              <Image
                source={{ uri: entry.photoUrl }}
                style={[styles.photo, { backgroundColor: tokens.tile }]}
                contentFit="cover"
                accessibilityLabel={fmt(t.baby.log.entry.photoOf, {
                  type: t.baby.eventTypes[type],
                })}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </>
        )}

        {failure ? (
          <Text style={[styles.error, { color: tokens.danger }]}>
            {failure}
          </Text>
        ) : null}

        <View style={styles.buttons}>
          {editing ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setEditing(false)}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  { borderColor: tokens.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, { color: tokens.fg }]}>
                  {t.actions.cancel}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy || blocked}
                onPress={save}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: blocked ? tokens.tile : tokens.accent,
                  },
                  (pressed || busy) && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={tokens.surface} />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      { color: blocked ? tokens.muted : tokens.surface },
                    ]}
                  >
                    {t.actions.save}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmDelete}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  { borderColor: tokens.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, { color: tokens.danger }]}>
                  {t.actions.delete}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                // Always passed, never omitted: the two modes swap two buttons
                // in and out of the same two positions, and a `disabled` that
                // is present on one render and absent on the next leaves the
                // recycled native view still announcing itself as disabled to
                // a screen reader.
                disabled={busy}
                onPress={beginEditing}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: tokens.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, { color: tokens.surface }]}>
                  {t.actions.edit}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // No top padding of its own: the sheet's own bar is the top edge now, and
  // adding a second one under it is what read as "not native".
  content: { paddingHorizontal: 18, paddingTop: 4, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  when: { flex: 1, fontSize: 13 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
  },
  detailName: { flex: 1, fontSize: 14 },
  detailValue: { fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  notesRead: { fontSize: 15, lineHeight: 21 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.card },
  notes: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  error: { fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
