/**
 * Everything about one Child that is a setting rather than a log entry.
 *
 * **One screen, two doors** (ADR-0022): Settings → Modules → Baby log reaches
 * it, and so does the Module itself. Nothing is duplicated, so nothing can
 * drift, and Settings is an alternative way in rather than the other half of
 * the answer.
 *
 * Its first card is the Child themselves — name, birth date, sex. The create
 * wizard captures them once, and a typo in a name, or a birth date a digit out
 * (which quietly moves every age on every screen), has to be correctable. The switcher's pencil is the
 * door people actually find, since that is the only screen listing children.
 *
 * Tracked types are the substance. Turning one off shrinks what the log offers
 * and touches nothing already recorded — the notice under the switches says so,
 * because a parent who thinks they deleted twelve medication entries will not
 * find out otherwise until they need them.
 */
import type { BabySex } from '@gather/core/baby-events'
import { isIsoDate } from '@gather/core/civil-date'
import {
  BABY_BAR_SHORTCUTS,
  BABY_EVENT_TYPES,
  type BabyBarSlot,
  babyBarSlots,
  isBabyBarShortcut,
  trackedEventTypes,
} from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { ListPicker, type PickedList } from './ListPicker'
import { LogBar, slotIcon, slotLabel } from './LogBar'
import { useWriteChildBar } from './useWriteChildBar'

export function ChildSettings({ childId }: { childId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const { group } = useGroup()
  const groupSlug = group.slug

  const child = useQuery(api.babies.get, {
    id: childId as Id<'babies'>,
    groupSlug,
  })
  const lists = useQuery(api.taskLists.list, { groupSlug })
  const update = useMutation(api.babies.update)
  const writeBar = useWriteChildBar()
  const remove = useMutation(api.babies.remove)
  const [busy, setBusy] = useState(false)

  // The two text fields are held locally and written on blur, so a name is not
  // sent to the server on every keystroke — and so a half-typed date never
  // becomes the stored one. `null` means "not being edited", which is why the
  // boxes read from the record rather than being seeded from it: a draft only
  // exists between a keystroke and a blur, so there is no stale copy to sync.
  const [draftName, setDraftName] = useState<string | null>(null)
  const [draftBirthDate, setDraftBirthDate] = useState<string | null>(null)
  const [detailsFailed, setDetailsFailed] = useState(false)

  // What the switches show while a write is in flight.
  //
  // `Switch` is controlled: on tap it flips itself natively, React re-renders
  // it still holding the old value so it animates *back*, and then the mutation
  // lands and it animates forward again. That is the double flick — every
  // switch in the card re-renders, so every switch does it. Holding the
  // intended list locally means the re-render already agrees with the finger.
  const [intended, setIntended] = useState<BabyBarSlot[] | null>(null)
  const [reordering, setReordering] = useState(false)

  if (child === undefined) {
    return <View style={{ flex: 1, backgroundColor: tokens.ground }} />
  }
  if (child === null) {
    return (
      <View style={[styles.missing, { backgroundColor: tokens.ground }]}>
        <Text style={{ color: tokens.muted }}>{t.baby.log.child.notFound}</Text>
      </View>
    )
  }

  // Bound once, after the two early returns: the closures below outlive this
  // render, and TypeScript will not carry a narrowing into them.
  const record = child
  // The log bar itself, reconciled the same way the log reconciles it: absent
  // means all eight types in catalogue order with both shortcuts after them.
  // The order is the bar's order, so it is preserved rather than re-sorted.
  const slots: BabyBarSlot[] = intended ?? [
    ...babyBarSlots(trackedEventTypes(record.untrackedTypes), record.barOrder),
  ]
  // Everything the bar could hold and does not, event types first — a
  // shortcut is off the bar only because somebody took it off.
  const unused: BabyBarSlot[] = [
    ...BABY_EVENT_TYPES.filter((type) => !slots.includes(type)),
    ...BABY_BAR_SHORTCUTS.filter((shortcut) => !slots.includes(shortcut)),
  ]

  const pendingName =
    draftName !== null && draftName.trim() !== record.name.trim()
  const pendingBirthDate =
    draftBirthDate !== null && draftBirthDate.trim() !== record.birthDate.trim()

  /**
   * One mutation for all three details, because `babies.update` takes name and
   * birth date as required arguments: sending one always resends the others,
   * and the drafts are what they currently read as on screen.
   */
  async function saveDetails(patch: {
    name?: string
    birthDate?: string
    sex?: BabySex
  }) {
    const name = (patch.name ?? draftName ?? record.name).trim()
    const birthDate = (
      patch.birthDate ??
      draftBirthDate ??
      record.birthDate
    ).trim()

    // Called from every blur, so an untouched field must not write. Without
    // this, tapping through the card would re-send the record to itself.
    if (
      name === record.name.trim() &&
      birthDate === record.birthDate.trim() &&
      patch.sex === undefined
    ) {
      setDraftName(null)
      setDraftBirthDate(null)
      setDetailsFailed(false)
      return
    }

    // A blank name or a date that is not a date is refused here rather than
    // stored: `birthDate` drives every age in the Module.
    if (!name || !isIsoDate(birthDate)) {
      setDetailsFailed(true)
      return
    }
    setBusy(true)
    setDetailsFailed(false)
    try {
      await update({
        id: record._id,
        groupSlug,
        name,
        birthDate,
        sex: patch.sex ?? record.sex ?? 'unspecified',
      })
      setDraftName(null)
      setDraftBirthDate(null)
    } catch {
      setDetailsFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function setSlots(next: BabyBarSlot[]) {
    // Shown first, sent second. Cleared only once the write is through, so the
    // switches never animate back to a value the person already changed.
    setIntended(next)
    setBusy(true)
    try {
      await writeBar(record, next)
      setIntended(null)
    } catch {
      setIntended(null)
    } finally {
      setBusy(false)
    }
  }

  if (reordering) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.ground,
          justifyContent: 'flex-end',
        }}
      >
        <LogBar
          slots={slots}
          onPick={() => {}}
          onReorder={setSlots}
          onHide={() => {}}
          onShowAll={() => {}}
          reorderOnMount
          onDone={() => setReordering(false)}
        />
      </View>
    )
  }

  async function repoint(
    field: 'taskListId' | 'questionsListId',
    picked: PickedList,
  ) {
    if (picked.kind !== 'existing') return
    setBusy(true)
    try {
      await update({
        id: record._id,
        groupSlug,
        name: record.name,
        birthDate: record.birthDate,
        [field]: picked.listId as Id<'taskLists'>,
      })
    } finally {
      setBusy(false)
    }
  }

  function confirmDelete() {
    confirmDestructive({
      title: fmt(t.baby.log.form.deleteTitle, { name: record.name }),
      message: t.baby.log.form.deleteBody,
      confirm: fmt(t.baby.log.form.deleteConfirm, { name: record.name }),
      cancel: t.common.actions.cancel,
      onConfirm: async () => {
        await remove({ id: record._id, groupSlug })
        router.back()
      },
    })
  }

  const pickedFor = (listId: string | undefined): PickedList => {
    const found = lists?.find((list) => list._id === listId)
    return found
      ? {
          kind: 'existing',
          listId: found._id,
          writable: found.writable,
          provider: found.provider,
        }
      : { kind: 'new' }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Text style={[styles.name, { color: tokens.ink }]}>{record.name}</Text>
      <Text style={[styles.group, { color: tokens.muted }]}>{group.name}</Text>

      <Text style={[styles.sectionTitle, { color: tokens.muted }]}>
        {t.baby.log.form.detailsTitle}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.hair },
        ]}
      >
        <View style={[styles.fieldRow, { borderBottomColor: tokens.hair }]}>
          <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
            {t.baby.log.form.name}
          </Text>
          <TextInput
            value={draftName ?? record.name}
            onChangeText={setDraftName}
            onBlur={() => saveDetails({ name: draftName ?? record.name })}
            onSubmitEditing={() =>
              saveDetails({ name: draftName ?? record.name })
            }
            returnKeyType="done"
            accessibilityLabel={t.baby.log.form.name}
            style={[styles.fieldInput, { color: tokens.ink }]}
          />
          {pendingName ? (
            <SaveEdit
              label={t.common.actions.save}
              busy={busy}
              onPress={() => saveDetails({ name: draftName ?? record.name })}
            />
          ) : null}
        </View>
        <View style={[styles.fieldRow, { borderBottomColor: tokens.hair }]}>
          <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
            {t.baby.log.form.birthDate}
          </Text>
          <TextInput
            value={draftBirthDate ?? record.birthDate}
            onChangeText={setDraftBirthDate}
            onBlur={() =>
              saveDetails({ birthDate: draftBirthDate ?? record.birthDate })
            }
            onSubmitEditing={() =>
              saveDetails({ birthDate: draftBirthDate ?? record.birthDate })
            }
            returnKeyType="done"
            placeholder={t.baby.log.form.birthDatePlaceholder}
            placeholderTextColor={tokens.muted}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={t.baby.log.form.birthDate}
            style={[styles.fieldInput, { color: tokens.ink }]}
          />
          {pendingBirthDate ? (
            <SaveEdit
              label={t.common.actions.save}
              busy={busy}
              onPress={() =>
                saveDetails({ birthDate: draftBirthDate ?? record.birthDate })
              }
            />
          ) : null}
        </View>
        <View style={styles.sexRow}>
          <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
            {t.baby.log.form.sex}
          </Text>
          <View style={styles.segments}>
            {(
              [
                ['female', t.baby.log.form.sexFemale],
                ['male', t.baby.log.form.sexMale],
                ['unspecified', t.baby.log.form.sexUnspecified],
              ] as const
            ).map(([value, label]) => {
              const on = (record.sex ?? 'unspecified') === value
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  disabled={busy}
                  onPress={() => saveDetails({ sex: value })}
                  style={[
                    styles.segment,
                    {
                      borderColor: on ? tokens.ink : tokens.hair,
                      backgroundColor: on ? tokens.ink : tokens.ground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      on ? TYPE.footnoteStrong : TYPE.footnote,
                      styles.segmentLabel,
                      { color: on ? tokens.onInk : tokens.ink },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
      {detailsFailed ? (
        <Text style={[styles.detailsError, { color: tokens.danger }]}>
          {t.baby.log.form.saveFailed}
        </Text>
      ) : null}

      <Text style={[styles.sectionTitle, { color: tokens.muted }]}>
        {t.baby.log.tracked.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.actions.reorder}
        onPress={() => setReordering(true)}
        style={({ pressed }) => [
          styles.reorder,
          { backgroundColor: tokens.surface2 },
          pressed && styles.pressed,
        ]}
      >
        <UI_ICONS.GripVertical size={18} color={tokens.muted} />
        <Text style={[styles.reorderText, { color: tokens.ink }]}>
          {t.actions.reorder}
        </Text>
      </Pressable>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.hair },
        ]}
      >
        {slots.map((slot) => {
          const Icon = slotIcon(slot)
          const label = slotLabel(slot, t)
          const shortcut = isBabyBarShortcut(slot)
          return (
            <View
              key={slot}
              style={[styles.row, { borderBottomColor: tokens.hair }]}
            >
              <UI_ICONS.GripVertical size={18} color={tokens.muted} />
              <Icon
                size={20}
                color={shortcut ? tokens.muted : tokens.ink}
                strokeWidth={1.9}
              />
              <Text style={[styles.rowLabel, { color: tokens.ink }]}>
                {label}
              </Text>
              <Switch
                value
                accessibilityLabel={label}
                onValueChange={() =>
                  setSlots(slots.filter((each) => each !== slot))
                }
                trackColor={{ false: tokens.surface2 }}
              />
            </View>
          )
        })}

        {unused.map((slot) => {
          const Icon = slotIcon(slot)
          const label = slotLabel(slot, t)
          return (
            <View
              key={slot}
              style={[styles.row, { borderBottomColor: tokens.hair }]}
            >
              <View style={styles.gripSpace} />
              <Icon size={20} color={tokens.muted} strokeWidth={1.9} />
              <Text style={[styles.rowLabel, { color: tokens.muted }]}>
                {label}
              </Text>
              <Switch
                value={false}
                accessibilityLabel={label}
                // Appended rather than slotted into catalogue order: the thing
                // you just turned on is the thing you were looking for.
                onValueChange={() => setSlots([...slots, slot])}
                trackColor={{ false: tokens.surface2 }}
              />
            </View>
          )
        })}
      </View>
      <Text style={[styles.orderHint, { color: tokens.muted }]}>
        {t.baby.log.tracked.orderHint}
      </Text>
      <View style={[styles.notice, { backgroundColor: tokens.surface2 }]}>
        <UI_ICONS.CircleAlert
          size={18}
          color={tokens.muted}
          strokeWidth={1.9}
        />
        <Text style={[styles.noticeText, { color: tokens.muted }]}>
          {t.baby.log.tracked.keepsEntries}
        </Text>
      </View>

      <ListPicker
        title={t.baby.log.lists.todos}
        defaultName={`${record.name} ${t.baby.log.lists.todos.toLowerCase()}`}
        lists={lists ?? []}
        value={pickedFor(record.taskListId)}
        onChange={(next) => repoint('taskListId', next)}
        groupName={group.name}
      />

      <ListPicker
        title={t.baby.log.lists.questions}
        defaultName={`${record.name} ${t.baby.log.lists.questions.toLowerCase()}`}
        lists={lists ?? []}
        value={pickedFor(record.questionsListId)}
        onChange={(next) => repoint('questionsListId', next)}
        groupName={group.name}
      />

      <Pressable
        accessibilityRole="button"
        onPress={confirmDelete}
        style={({ pressed }) => [
          styles.delete,
          { borderColor: tokens.hair },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.deleteText, { color: tokens.danger }]}>
          {fmt(t.baby.log.form.deleteConfirm, { name: record.name })}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

/**
 * The confirm that appears beside a details field while its edit is unsaved.
 *
 * Blur alone is not enough: pressing Back unmounts the screen without ever
 * blurring the box, so a name somebody typed and did not tap away from was
 * quietly discarded. This makes the pending state visible — and gives it a
 * target — so nothing is lost without being seen first.
 */
function SaveEdit({
  label,
  busy,
  onPress,
}: {
  label: string
  busy: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.saveEdit,
        { backgroundColor: tokens.surface2 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.saveEditText, { color: tokens.ink }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  saveEdit: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  saveEditText: { ...TYPE.bodyStrong },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { ...TYPE.title2, letterSpacing: -0.7 },
  group: { ...TYPE.footnote, marginBottom: 8 },
  sectionTitle: {
    ...TYPE.footnoteStrong,
    marginTop: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { ...TYPE.body, flex: 1 },
  gripSpace: { width: 18 },
  reorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  reorderText: { ...TYPE.bodyStrong },
  orderHint: { ...TYPE.footnote, paddingHorizontal: 2 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { ...TYPE.subhead, width: 96 },
  fieldInput: {
    ...TYPE.body,
    flex: 1,
    paddingVertical: 12,
    textAlign: 'right',
  },
  sexRow: { paddingVertical: 12, gap: 8 },
  segments: { flexDirection: 'row', gap: 8 },
  segmentLabel: { textAlign: 'center' },
  // "Prefer not to say" wraps at a large text size; the segment grows.
  segment: {
    flex: 1,
    minHeight: SIZE.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[1],
    paddingVertical: SPACE[1],
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  detailsError: { ...TYPE.subhead },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.card,
  },
  noticeText: { ...TYPE.footnote, flex: 1 },
  delete: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  deleteText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
