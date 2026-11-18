/**
 * A packing list's two extras (APP-306): how much is packed, and Uncheck all.
 *
 * A packing list is ticked off for one trip and reset for the next, so its
 * checked items stay where they are (`keepsCheckedInPlace`) and the list ends
 * with a button that unticks the lot. That button is undoable rather than
 * confirmed (`apps/mobile/DESIGN_SYSTEM.md`: undo or confirm, never both): it
 * becomes Undo, which re-ticks exactly the items it unticked, until somebody
 * ticks something again or leaves the list.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { TASK_ICONS } from './icons'
import { useTaskActions } from './store'

/** "7 of 18 packed" over a bar. */
export function PackingProgress({
  done,
  total,
}: {
  done: number
  total: number
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const label = fmt(t.tasks.packing.progress, { done, total })
  return (
    <View
      testID="packing-progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${t.tasks.packing.packed}`}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <View style={styles.figure}>
        <Text style={[styles.numeral, { color: tokens.ink }]}>{label}</Text>
        <Text style={[styles.packed, { color: tokens.muted }]}>
          {t.tasks.packing.packed}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: tokens.surface2 }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: tokens.accentText,
              width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

/** Uncheck all, which turns into Undo until something is ticked again. */
export function UncheckAll({
  listId,
  doneCount,
}: {
  listId: string
  doneCount: number
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const actions = useTaskActions()
  const [unchecked, setUnchecked] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  // Ticking anything after the reset ends the undo: from then on "undo" would
  // mean something nobody could predict.
  const undoable = unchecked !== null && unchecked.length > 0 && doneCount === 0
  const disabled = busy || (!undoable && doneCount === 0)

  const press = async () => {
    if (disabled) return
    setBusy(true)
    try {
      if (undoable) {
        await actions.setDoneInList(listId, true, unchecked)
        setUnchecked(null)
        haptics.itemCompleted()
      } else {
        setUnchecked(await actions.setDoneInList(listId, false))
        haptics.itemSaved()
      }
    } catch {
      haptics.actionFailed()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.reset}>
      <Pressable
        testID={undoable ? 'packing-undo' : 'packing-uncheck-all'}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={press}
        style={({ pressed }) => [
          styles.resetButton,
          { backgroundColor: tokens.surface },
          pressed && { backgroundColor: tokens.surface2 },
          disabled && styles.disabled,
        ]}
      >
        <TASK_ICONS.Reset
          size={18}
          color={tokens.ink}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.resetLabel, { color: tokens.ink }]}>
          {undoable ? t.tasks.packing.undo : t.tasks.packing.uncheckAll}
        </Text>
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.hint, { color: tokens.muted }]}
      >
        {undoable ? t.tasks.packing.uncheckedAll : t.tasks.packing.uncheckAllHint}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: SPACE[4],
    gap: 10,
  },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  numeral: { ...TYPE.numeralL, ...TABULAR },
  packed: { ...TYPE.subhead },
  track: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: RADIUS.pill },
  reset: { gap: 6 },
  resetButton: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
  },
  resetLabel: { ...TYPE.bodyStrong },
  hint: { ...TYPE.footnote, textAlign: 'center' },
  disabled: { opacity: 0.4 },
})
