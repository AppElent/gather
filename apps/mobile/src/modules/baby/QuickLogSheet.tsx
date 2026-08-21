/**
 * The sheet a quick-log button opens: pre-filled with now and with what was
 * chosen last time, one tap from Save.
 *
 * Two taps to log, not one. Almost every type needs *something* — a diaper is
 * wet or dirty, a feed is breast or bottle — so logging instantly on the first
 * tap would guess on most types and bury the guess. Pre-filling shows it
 * instead, and a wrong diaper kind that survives an undo toast is wrong forever
 * in a record somebody may show a doctor.
 *
 * ## Several things at one moment
 *
 * A nappy change, a feed and a nap down are one event in a parent's head and
 * three rows in the database. Logging them one after another gives each its own
 * timestamp a minute apart, and nothing downstream can then tell they belonged
 * together — so the sheet takes the time **once** and writes every included
 * type at exactly that instant. The shared timestamp is the whole point: it is
 * what lets a view group them without guessing.
 *
 * Everything else follows from that. Each included type keeps its own fields
 * and its own notes, because a note about the feed is not a note about the
 * nappy, and one line copied onto three entries reads as three observations.
 * The type you arrived with can be removed like any other, as long as one
 * remains: a save with nothing in it is not a thing to offer.
 *
 * With one type included — the ordinary case — this is exactly the sheet it was
 * before, and none of the above is visible.
 *
 * The frame — drag-to-dismiss, close button, scrim — is `Sheet`'s; this file is
 * only what the sheet asks.
 */
import type { BabyEventType } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { DateTimeField } from './DateTimeField'
import { EntryFields, fieldLabel } from './EntryFields'
import { EVENT_ICONS } from './icons'
import { PhotoField } from './PhotoField'
import {
  buildSheetData,
  endTimestampFor,
  initialPicks,
  lastOfType,
  missingRequired,
  outOfRangeFields,
  type PreviousEvent,
} from './sheetFields'

export interface QuickLogSheetProps {
  babyId: Id<'babies'>
  childName: string
  groupSlug: string
  /** The type the button that opened this asked for. */
  type: BabyEventType
  /** What else this Child can be logged with, in its own order. */
  tracked: readonly BabyEventType[]
  /** Used only to pre-fill; the sheet never writes to it. */
  previous: readonly PreviousEvent[]
  onClose: () => void
}

type Picks = Record<string, string>

export function QuickLogSheet({
  babyId,
  childName,
  groupSlug,
  type,
  tracked,
  previous,
  onClose,
}: QuickLogSheetProps) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const add = useMutation(api.babyEvents.add)
  const tint = tokens.tintOf('home')

  const [included, setIncluded] = useState<BabyEventType[]>([type])
  const [picks, setPicks] = useState<Record<string, Picks>>(() => ({
    [type]: initialPicks(type, lastOfType(previous, type)),
  }))
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [whenOpen, setWhenOpen] = useState(false)

  // `opened` is held once, at open: it anchors "Today" and "Yesterday" on the
  // When row, so they keep meaning the same day across a midnight somebody
  // happens to be logging through. `timestamp` is what gets written.
  const [opened] = useState(() => Date.now())
  const [timestamp, setTimestamp] = useState(opened)
  // Keyed by type for the same reason notes are: several types can be open at
  // once, and a picture of a first laugh is not a picture of a nappy.
  const [photos, setPhotos] = useState<
    Partial<Record<BabyEventType, string | null>>
  >({})

  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)

  const fieldLabels = t.baby.log.fields as Record<string, string>
  const several = included.length > 1

  /** Every out-of-range row, across every included type. */
  const rejected = included.flatMap((each) =>
    outOfRangeFields(each, picks[each] ?? {}).map((field) => ({
      owner: each,
      field,
    })),
  )

  /** Every included type still missing the one box it cannot save without. */
  const missing = included.flatMap((each) => {
    const key = missingRequired(each, picks[each] ?? {})
    return key ? [{ owner: each, key }] : []
  })

  const blocked = rejected.length > 0 || missing.length > 0

  function toggle(each: BabyEventType) {
    // Seeded on first inclusion rather than up front, so a type nobody adds
    // never costs a pass over the history.
    setPicks((prev) =>
      prev[each]
        ? prev
        : { ...prev, [each]: initialPicks(each, lastOfType(previous, each)) },
    )
    setIncluded((current) => {
      if (current.includes(each)) {
        // Never down to nothing: a sheet with no type has no Save to press.
        return current.length === 1
          ? current
          : current.filter((one) => one !== each)
      }
      // Kept in the Child's own order, not the order they were ticked.
      return tracked.filter((one) => current.includes(one) || one === each)
    })
  }

  function update(owner: BabyEventType, key: string, value: string) {
    setPicks((prev) => ({
      ...prev,
      [owner]: { ...(prev[owner] ?? {}), [key]: value },
    }))
  }

  async function save() {
    if (blocked) return
    setSaving(true)
    setFailure(null)

    // One at a time rather than in a single mutation: `babyEvents.add` is the
    // only door, and going through it keeps every entry validated and
    // attributed exactly as a lone log is. They still share `timestamp`, which
    // is what the grouping actually rests on.
    const failed: BabyEventType[] = []
    for (const each of included) {
      try {
        await add({
          babyId,
          groupSlug,
          type: each,
          timestamp,
          endTimestamp: endTimestampFor(each, picks[each] ?? {}, timestamp),
          notes: notes[each]?.trim() || undefined,
          photoId: photos[each] as Id<'_storage'> | undefined,
          data: buildSheetData(each, picks[each] ?? {}) as never,
        })
      } catch {
        failed.push(each)
      }
    }

    if (failed.length === 0) {
      haptics.itemSaved()
      onClose()
      return
    }
    haptics.actionFailed()
    // Stays open holding only what did not land, and says so. Closing on a
    // partial save would hide the half that is missing; keeping the half that
    // saved would write it twice on the next press.
    const saved = included.length - failed.length
    setFailure(
      saved === 0
        ? t.baby.log.entry.saveFailed
        : fmt(t.baby.log.multi.partial, {
            saved,
            total: included.length,
            detail: failed.map((each) => t.baby.eventTypes[each]).join(', '),
          }),
    )
    setIncluded(failed)
    setSaving(false)
  }

  return (
    <NativeSheet
      title={several ? t.baby.log.multi.heading : t.baby.eventTypes[type]}
      subtitle={childName}
      onClose={onClose}
      maxHeight={Platform.OS === 'ios' ? 0.92 : undefined}
      fill={Platform.OS === 'ios'}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={saving || blocked}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: blocked ? tokens.tile : tokens.accent,
            },
            (pressed || saving) && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={tokens.surface} />
          ) : (
            <Text
              style={[
                styles.saveText,
                { color: blocked ? tokens.muted : tokens.surface },
              ]}
            >
              {several
                ? plural(locale, included.length, t.baby.log.multi.save)
                : t.actions.save}
            </Text>
          )}
        </Pressable>
      }
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={styles.scroll}
        contentContainerStyle={styles.body}
      >
        <DateTimeField
          value={timestamp}
          onChange={setTimestamp}
          now={opened}
          open={whenOpen}
          onToggle={() => setWhenOpen((was) => !was)}
        />

        {/* What else happened at this moment. Hidden when the Child tracks one
            type, because there is then no "also" to offer. */}
        {tracked.length > 1 ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
              {t.baby.log.multi.include.toUpperCase()}
            </Text>
            <View style={styles.chips}>
              {tracked.map((each) => {
                const on = included.includes(each)
                const Icon = EVENT_ICONS[each]
                return (
                  <Pressable
                    key={each}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t.baby.eventTypes[each]}
                    onPress={() => toggle(each)}
                    style={[
                      styles.includeChip,
                      {
                        borderColor: on ? tokens.accent : tokens.border,
                        backgroundColor: on ? tint.bg : tokens.bg,
                      },
                    ]}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.9}
                      color={on ? tokens.accent : tokens.muted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: on ? tokens.accent : tokens.fg,
                          fontWeight: on ? '700' : '500',
                        },
                      ]}
                    >
                      {t.baby.eventTypes[each]}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        {included.map((each) => (
          <View key={each} style={styles.section}>
            {several ? (
              <View
                style={[styles.sectionHead, { borderTopColor: tokens.border }]}
              >
                <Text style={[styles.sectionTitle, { color: tokens.fg }]}>
                  {t.baby.eventTypes[each]}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.actions.delete}
                  onPress={() => toggle(each)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.remove,
                    { backgroundColor: tokens.tile },
                    pressed && styles.pressed,
                  ]}
                >
                  <UI_ICONS.X
                    size={15}
                    color={tokens.muted}
                    strokeWidth={2.2}
                  />
                </Pressable>
              </View>
            ) : null}

            <EntryFields
              type={each}
              picks={picks[each] ?? {}}
              onChange={(key, value) => update(each, key, value)}
            />

            <TextInput
              value={notes[each] ?? ''}
              onChangeText={(next) =>
                setNotes((prev) => ({ ...prev, [each]: next }))
              }
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

            {/* Only Memory offers a photo today. The control is general —
                `photoId` is on the event, not inside a Memory's payload — so
                the day a rash photo belongs on a Note this is one line. */}
            {each === 'memory' ? (
              <PhotoField
                value={photos[each]}
                onChange={(storageId) =>
                  setPhotos((prev) => ({ ...prev, [each]: storageId }))
                }
                generateUploadUrl={generateUploadUrl}
                typeLabel={t.baby.eventTypes[each]}
                disabled={saving}
              />
            ) : null}
          </View>
        ))}

        {missing.map(({ owner, key }) => (
          <Text
            key={`${owner}.${key}`}
            style={[styles.error, { color: tokens.danger }]}
          >
            {t.baby.log.validation[key]}
          </Text>
        ))}

        {rejected.map(({ owner, field }) => (
          <Text
            key={`${owner}.${field.key}`}
            style={[styles.error, { color: tokens.danger }]}
          >
            {fmt(t.baby.log.validation.outOfRange, {
              field: fieldLabel(fieldLabels, field),
              min: field.min ?? 0,
              max: field.max ?? 0,
            })}
          </Text>
        ))}

        {failure ? (
          <Text style={[styles.error, { color: tokens.danger }]}>
            {failure}
          </Text>
        ) : null}
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { gap: 14, paddingBottom: 14 },
  field: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 12 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  remove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  includeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.control,
  },
  chipText: { fontSize: 15 },
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
  save: {
    minHeight: 52,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { fontSize: 16.5, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
