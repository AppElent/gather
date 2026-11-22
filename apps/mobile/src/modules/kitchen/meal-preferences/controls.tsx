/**
 * The small controls the Eetvoorkeuren screen is built from (design section
 * 2, designs/meal-planner/README.md): chips, day chips, a stepper, the
 * cooking-time grid and a row that holds a control under its heading.
 *
 * Selected chips are `ink` with `onInk` text and a check, so the state is
 * never colour alone; unselected chips sit on `ground` inside the `surface`
 * card with a `hair` edge, as the baby log's chips do. The artboard's
 * `hairStrong` edge is not in the phone's palette, and the fill already
 * separates the chip from the card.
 */
import type { CookingMinutes, Weekday } from '@gather/core/meal-preferences'
import { WEEKDAYS } from '@gather/core/meal-preferences'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../../feedback/haptics'
import { UI_ICONS } from '../../../theme/icons'
import {
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../../../theme/tokens'
import { useInsetSeparator } from '../../../ui/inset-list'
import { SectionLabel } from '../../../ui/section-label'

/** A heading, its card and an optional footnote, as every section reads. */
export function PrefSection({
  heading,
  footnote,
  children,
}: {
  heading: string
  footnote?: string
  children: ReactNode
}) {
  const tokens = useTokens()
  return (
    <View style={styles.section}>
      <View accessible accessibilityRole="header">
        <SectionLabel>{heading}</SectionLabel>
      </View>
      {children}
      {footnote ? (
        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {footnote}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * A row of an inset list that holds a control below its heading (chips, the
 * minutes grid, the dislike tags). It draws the list's separator itself.
 */
export function BlockRow({
  title,
  subtitle,
  trailing,
  children,
}: {
  title?: string
  subtitle?: string
  trailing?: ReactNode
  children?: ReactNode
}) {
  const tokens = useTokens()
  const separator = useInsetSeparator()
  return (
    <View style={[styles.blockRow, { backgroundColor: tokens.surface }]}>
      <View style={[styles.blockContent, separator]}>
        {title ? (
          <View style={styles.blockHead}>
            <View style={styles.blockText}>
              <Text style={[TYPE.body, { color: tokens.ink }]}>{title}</Text>
              {subtitle ? (
                <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {trailing}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  )
}

export function Chip({
  label,
  accessibilityLabel,
  selected,
  onPress,
  disabled = false,
  testID,
}: {
  label: string
  accessibilityLabel?: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
  testID?: string
}) {
  const tokens = useTokens()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        haptics.selectionChanged()
        onPress()
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tokens.ink : tokens.ground,
          borderColor: selected ? tokens.ink : tokens.hair,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {selected ? (
        <UI_ICONS.Check
          size={14}
          strokeWidth={3}
          color={tokens.onInk}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Text
        style={[
          selected ? styles.chipLabelOn : styles.chipLabel,
          { color: selected ? tokens.onInk : tokens.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>
}

/** Seven day chips, Monday first. */
export function DayChips({
  selected,
  onToggle,
  short,
  long,
  disabled = false,
  testID,
}: {
  selected: readonly Weekday[]
  onToggle: (day: Weekday) => void
  short: readonly string[]
  long: readonly string[]
  disabled?: boolean
  testID?: string
}) {
  return (
    <ChipWrap>
      {WEEKDAYS.map((day) => (
        <Chip
          key={day}
          testID={testID ? `${testID}-${day}` : undefined}
          label={short[day]}
          accessibilityLabel={long[day]}
          selected={selected.includes(day)}
          disabled={disabled}
          onPress={() => onToggle(day)}
        />
      ))}
    </ChipWrap>
  )
}

/** − value +, each button its own target; the value is announced politely. */
export function Stepper({
  value,
  label,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
  testID,
}: {
  value: string
  label: string
  decreaseLabel: string
  increaseLabel: string
  onDecrease: () => void
  onIncrease: () => void
  canDecrease: boolean
  canIncrease: boolean
  testID?: string
}) {
  const tokens = useTokens()
  const step = (glyph: string, a11y: string, enabled: boolean, run: () => void, id: string) => (
    <Pressable
      testID={testID ? `${testID}-${id}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}, ${label}`}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={4}
      onPress={() => {
        haptics.selectionChanged()
        run()
      }}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: tokens.surface2 },
        pressed && styles.pressed,
        !enabled && styles.disabled,
      ]}
    >
      <Text style={[styles.stepGlyph, { color: tokens.ink }]}>{glyph}</Text>
    </Pressable>
  )
  return (
    <View style={styles.stepper}>
      {step('−', decreaseLabel, canDecrease, onDecrease, 'minus')}
      <Text
        testID={testID ? `${testID}-value` : undefined}
        accessibilityLabel={`${label}: ${value}`}
        accessibilityLiveRegion="polite"
        style={[styles.stepValue, { color: tokens.ink }]}
      >
        {value}
      </Text>
      {step('+', increaseLabel, canIncrease, onIncrease, 'plus')}
    </View>
  )
}

/** Seven cells, one per day; a tap moves to the next time on the cycle. */
export function MinutesGrid({
  minutes,
  dayShort,
  formatMinutes,
  labelOf,
  hint,
  onCycle,
}: {
  minutes: readonly (CookingMinutes | null)[]
  dayShort: readonly string[]
  formatMinutes: (minutes: CookingMinutes | null) => string
  labelOf: (day: Weekday, minutes: CookingMinutes | null) => string
  hint: string
  onCycle: (day: Weekday) => void
}) {
  const tokens = useTokens()
  return (
    <View style={styles.grid}>
      {WEEKDAYS.map((day) => (
        <Pressable
          key={day}
          testID={`meal-prefs-minutes-${day}`}
          accessibilityRole="button"
          accessibilityLabel={labelOf(day, minutes[day] ?? null)}
          accessibilityHint={hint}
          onPress={() => {
            haptics.selectionChanged()
            onCycle(day)
          }}
          style={({ pressed }) => [
            styles.cell,
            { backgroundColor: tokens.ground },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[TYPE.footnoteStrong, { color: tokens.muted }]}
          >
            {dayShort[day]}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.cellValue, { color: tokens.ink }]}
          >
            {formatMinutes(minutes[day] ?? null)}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

/** A Member's initial on a `surface2` coin, as the planner's eater chips draw it. */
export function Coin({ name }: { name: string }) {
  const tokens = useTokens()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.coin, { backgroundColor: tokens.surface2 }]}
    >
      <Text style={[TYPE.footnoteStrong, { color: tokens.ink }]}>
        {name.trim().charAt(0).toLocaleUpperCase() || '?'}
      </Text>
    </View>
  )
}

// Off-scale numbers below, left raw on purpose (APP-446): `SPACE` steps by 4 to
// 24 and `SIZE` has no control height under `hitMin`, so there is no token for
// them. 10 is the row's vertical rhythm between 8 and 12; 6 the chip's
// check-to-label gap; 36 a chip or step button (44 with its hitSlop of 4); 56
// the stepper value's width; 60 a cooking-time cell; 14 its radius; 2 a
// hairline gap. `SIZE.tileM`/`tileL` equal 36/56 but are tiles, not controls.
const styles = StyleSheet.create({
  section: { gap: SPACE[2] },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  blockRow: { paddingLeft: SPACE[4] },
  blockContent: {
    paddingRight: SPACE[4],
    paddingVertical: 10,
    minHeight: SIZE.rowMin,
    justifyContent: 'center',
    gap: 10,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  blockText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACE[3],
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: { ...TYPE.subhead },
  chipLabelOn: { ...TYPE.subhead, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  stepButton: {
    width: SIZE.hitMin,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...TYPE.bodyStrong },
  stepValue: {
    ...TYPE.bodyStrong,
    ...TABULAR,
    minWidth: 56,
    textAlign: 'center',
  },
  grid: { flexDirection: 'row', gap: SPACE[1] },
  cell: {
    flex: 1,
    minHeight: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  cellValue: { ...TYPE.bodyStrong, ...TABULAR, fontWeight: '700' },
  coin: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
})
