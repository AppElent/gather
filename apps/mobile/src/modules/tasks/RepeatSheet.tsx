/**
 * The Repeat sheet (APP-303, designs/tasks §4): never, on a fixed schedule,
 * or a set time after it was done.
 *
 * Unlike the other property sheets this one has a Done button. A rule is
 * several choices at once (how often, which days), and writing after each tap
 * would move the task's date through rules nobody meant. Cancel leaves the
 * task as it was.
 *
 * A new monthly or yearly rule takes its day from the due date, so the sheet
 * shows that day rather than asking for it: one date, not two that can
 * disagree. An existing one keeps its own day, which a clamped due date (the
 * 30th of a rule on the 31st) no longer shows.
 */
import { MenuView } from '@expo/ui/community/menu'
import { localMidnight, todayIn } from '@gather/core/civil-date'
import {
  AFTER_DONE_UNITS,
  firstScheduledDate,
  ISO_WEEKDAYS,
  nextDueDate,
  REPEAT_EVERY_MAX,
  REPEAT_UNITS,
  type RepeatUnit,
  sameRepeat,
  type TaskRepeat,
  upcomingDates,
  weekdayName,
} from '@gather/core/task-repeat'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { Segmented } from '../../components/Segmented'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { useSheetDraft } from '../../ui/sheet-drafts'
import { type Draft, draftRule, repeatDraft } from './repeatDraft'
import { useTaskActions } from './store'
import type { Task } from './types'

export function RepeatSheet({
  task,
  place,
  onSave,
  onClose,
}: {
  task: Pick<Task, 'repeat' | 'dueDate'> & { id?: string }
  /** Where a task without an id is being made: keys its draft. */
  place?: string
  /**
   * Where the rule goes instead of the task: the keyboard composer's draft
   * (APP-587), for a task that does not exist yet.
   */
  onSave?: (rule: TaskRepeat | null) => void
  /** Told whether a share closed it, so nothing reopens over its chooser. */
  onClose: (byShare: boolean) => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.tasks.repeat
  const actions = useTaskActions()
  const { group } = useGroup()
  const today = todayIn(group.timeZone)
  const anchor = task.dueDate ?? today
  // A share keeps the rule being made (APP-622); the composer's task has no
  // id, so it is kept per composer.
  const kept = useSheetDraft<Draft>(`tasks:repeat:${task.id ?? place ?? 'composer'}`)
  const [draft, setDraft] = useState(
    () => kept.kept ?? repeatDraft(task, today),
  )
  kept.track(draft)
  const rule = draftRule(draft, anchor)
  const invalid = draft.mode !== 'none' && !rule

  const day = (iso: string) =>
    localMidnight(iso).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })

  const save = () => {
    if (invalid) return
    if (onSave) onSave(rule)
    else if (task.id && !sameRepeat(rule, task.repeat)) {
      actions.setRepeat(task.id, rule).catch(() => haptics.actionFailed())
    }
    onClose(kept.sharing())
  }

  const preview = (() => {
    if (draft.mode === 'none' || !rule) {
      return draft.mode === 'none' ? words.nextNever : words.pickDay
    }
    if (rule.mode === 'afterDone') {
      return fmt(words.nextIfDoneToday, { date: day(nextDueDate(rule, { today })) })
    }
    if (!task.dueDate) {
      const first = firstScheduledDate(rule, today, today)
      return [first, ...upcomingDates(rule, first, 2)].map(day).join(', ')
    }
    return fmt(words.nextAfter, {
      date: day(task.dueDate),
      dates: upcomingDates(rule, task.dueDate, 3).map(day).join(', '),
    })
  })()

  const unitWord = (unit: RepeatUnit, every: number) =>
    every === 1 ? words.units[unit].one : words.units[unit].other

  const setFixed = (change: Partial<Draft['fixed']>) =>
    setDraft((d) => ({ ...d, fixed: { ...d.fixed, ...change } }))
  const setAfterDone = (change: Partial<Draft['afterDone']>) =>
    setDraft((d) => ({ ...d, afterDone: { ...d.afterDone, ...change } }))

  const toggleDay = (isoDay: number) => {
    haptics.selectionChanged()
    const on = draft.fixed.weekdays.includes(isoDay)
    setFixed({
      weekdays: on
        ? draft.fixed.weekdays.filter((d) => d !== isoDay)
        : [...draft.fixed.weekdays, isoDay].sort(),
    })
  }

  const anchorText = (() => {
    if (draft.mode !== 'fixed' || !rule) return null
    if (rule.unit === 'month' && rule.monthDay !== undefined) {
      return fmt(words.onMonthDay, { day: rule.monthDay })
    }
    if (
      rule.unit === 'year' &&
      rule.month !== undefined &&
      rule.monthDay !== undefined
    ) {
      return fmt(words.onDate, {
        date: new Date(
          Date.UTC(2024, rule.month - 1, rule.monthDay),
        ).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }),
      })
    }
    return null
  })()
  const monthDay = rule?.monthDay ?? 0

  return (
    <NativeSheet
      title={words.title}
      onClose={() => onClose(kept.sharing())}
      confirm={{
        label: words.done,
        onPress: save,
        disabled: invalid,
        testID: 'repeat-done',
      }}
    >
      <View style={styles.body}>
        <Segmented
          options={[
            { value: 'none', label: words.modes.none },
            { value: 'fixed', label: words.modes.fixed },
            { value: 'afterDone', label: words.modes.afterDone },
          ]}
          value={draft.mode}
          onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
        />

        {draft.mode === 'fixed' ? (
          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            <IntervalRow
              label={words.every}
              every={draft.fixed.every}
              unit={draft.fixed.unit}
              units={REPEAT_UNITS}
              unitWord={unitWord}
              onEvery={(every) => setFixed({ every })}
              onUnit={(unit) => setFixed({ unit })}
              testID="repeat-fixed"
            />
            {draft.fixed.unit === 'week' ? (
              <View
                style={[styles.daysRow, { borderTopColor: tokens.hair }]}
              >
                <Text style={[styles.label, { color: tokens.ink }]}>
                  {words.on}
                </Text>
                <View style={styles.days}>
                  {ISO_WEEKDAYS.map((isoDay) => {
                    const on = draft.fixed.weekdays.includes(isoDay)
                    return (
                      <Pressable
                        key={isoDay}
                        testID={`repeat-day-${isoDay}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={weekdayName(isoDay, locale, 'long')}
                        onPress={() => toggleDay(isoDay)}
                        style={({ pressed }) => [
                          styles.day,
                          {
                            backgroundColor: on ? tokens.ink : tokens.surface2,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: on ? tokens.onInk : tokens.ink },
                          ]}
                        >
                          {weekdayName(isoDay, locale)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}
            {anchorText ? (
              <View style={[styles.daysRow, { borderTopColor: tokens.hair }]}>
                <Text style={[styles.label, { color: tokens.ink }]}>
                  {anchorText}
                </Text>
                <Text style={[styles.hint, { color: tokens.muted }]}>
                  {words.followsDate}
                  {monthDay > 28 ? ` ${fmt(words.lastDayHint, { day: monthDay })}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {draft.mode === 'afterDone' ? (
          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            <IntervalRow
              label={words.afterDone}
              every={draft.afterDone.every}
              unit={draft.afterDone.unit}
              units={AFTER_DONE_UNITS}
              unitWord={unitWord}
              onEvery={(every) => setAfterDone({ every })}
              onUnit={(unit) => setAfterDone({ unit })}
              testID="repeat-after"
            />
          </View>
        ) : null}

        <View
          testID="repeat-preview"
          accessibilityRole="summary"
          style={[
            styles.preview,
            { backgroundColor: tokens.tintOf('home').wash },
          ]}
        >
          <Text style={[styles.previewTitle, { color: tokens.ink }]}>
            {words.next}
          </Text>
          <Text style={[styles.previewText, { color: tokens.ink }]}>
            {preview}
          </Text>
        </View>

        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {draft.mode === 'none' ? words.footnoteNever : words.footnote}
        </Text>
      </View>
    </NativeSheet>
  )
}

/** "Every − 2 + weeks ⌄": a count and a unit, the unit from a native menu. */
function IntervalRow<Unit extends RepeatUnit>({
  label,
  every,
  unit,
  units,
  unitWord,
  onEvery,
  onUnit,
  testID,
}: {
  label: string
  every: number
  unit: Unit
  units: readonly Unit[]
  unitWord: (unit: RepeatUnit, every: number) => string
  onEvery: (every: number) => void
  onUnit: (unit: Unit) => void
  testID: string
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.tasks.repeat
  const step = (by: number) => {
    const next = Math.min(REPEAT_EVERY_MAX, Math.max(1, every + by))
    if (next === every) return
    haptics.selectionChanged()
    onEvery(next)
  }
  return (
    <View style={styles.intervalRow}>
      <Text style={[styles.label, styles.grow, { color: tokens.ink }]}>
        {label}
      </Text>
      <StepButton
        testID={`${testID}-decrease`}
        label={words.decrease}
        glyph="minus"
        disabled={every <= 1}
        onPress={() => step(-1)}
      />
      <Text
        testID={`${testID}-every`}
        style={[styles.count, { color: tokens.ink }]}
      >
        {every}
      </Text>
      <StepButton
        testID={`${testID}-increase`}
        label={words.increase}
        glyph="plus"
        disabled={every >= REPEAT_EVERY_MAX}
        onPress={() => step(1)}
      />
      <MenuView
        testID={`${testID}-unit`}
        actions={units.map((id) => ({
          id,
          title: unitWord(id, every),
          state: id === unit ? ('on' as const) : ('off' as const),
        }))}
        onPressAction={(event) => {
          const chosen = units.find((id) => id === event.nativeEvent.event)
          if (!chosen || chosen === unit) return
          haptics.selectionChanged()
          onUnit(chosen)
        }}
      >
        <View
          accessibilityRole="button"
          accessibilityLabel={`${every} ${unitWord(unit, every)}`}
          style={[styles.unit, { backgroundColor: tokens.surface2 }]}
        >
          <Text style={[styles.unitText, { color: tokens.ink }]}>
            {unitWord(unit, every)}
          </Text>
          <UI_ICONS.ChevronDown
            size={14}
            color={tokens.muted}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      </MenuView>
    </View>
  )
}

function StepButton({
  testID,
  label,
  glyph,
  disabled,
  onPress,
}: {
  testID: string
  label: string
  glyph: 'minus' | 'plus'
  disabled: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const Glyph = glyph === 'minus' ? UI_ICONS.Minus : UI_ICONS.Plus
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: tokens.surface2, opacity: disabled ? 0.4 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <Glyph size={18} color={tokens.ink} strokeWidth={2.4} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { gap: SPACE[4], paddingBottom: SPACE[4] },
  card: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: SIZE.rowMin + 8,
  },
  grow: { flex: 1 },
  label: { ...TYPE.body },
  count: {
    ...TYPE.bodyStrong,
    ...TABULAR,
    minWidth: 26,
    textAlign: 'center',
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: SPACE[3],
    borderRadius: RADIUS.pill,
  },
  unitText: { ...TYPE.subhead, fontWeight: '600' },
  daysRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE[3],
    gap: SPACE[2],
  },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: SIZE.hitMin,
    borderRadius: RADIUS.tileM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { ...TYPE.footnoteStrong },
  hint: { ...TYPE.footnote },
  preview: {
    borderRadius: RADIUS.card,
    padding: SPACE[4],
    gap: SPACE[1],
  },
  previewTitle: { ...TYPE.footnoteStrong },
  previewText: { ...TYPE.subhead },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  pressed: { opacity: 0.7 },
})
