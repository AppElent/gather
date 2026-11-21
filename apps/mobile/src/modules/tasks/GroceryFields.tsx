/**
 * A grocery item's amount and aisle (APP-309; `designs/groceries/README.md`,
 * "Recognition" and "Item sheet"), in the three places a grocery list shows
 * them: trailing a row, under the composer while a line is typed, and on the
 * item's own screen.
 *
 * The item screen keeps the Tasks rule of no Save: a step, a unit or an aisle
 * writes as it is chosen, and the typed amount writes when the field is left.
 * Choosing an aisle is also the Group's choice for the name from then on; the
 * server keeps it (`groceryCategoryOverrides`).
 */
import { MenuView } from '@expo/ui/community/menu'
import {
  formatGroceryAmount,
  GROCERY_AISLES,
  type GroceryAisle,
  type GroceryUnit,
  groceryAddFields,
  isGroceryAisle,
  isGroceryQuantity,
  roundGroceryQuantity,
  stepGroceryQuantity,
} from '@gather/core/groceries'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { useAisleOf } from '../kitchen/add-to-groceries/use-aisles'
import { useTaskActions } from './store'
import type { Task } from './types'

/** The units offered as pills, in the design's order; others stay readable. */
const OFFERED_UNITS: readonly GroceryUnit[] = [
  'stuks',
  'pak',
  'fles',
  'g',
  'kg',
  'ml',
  'l',
  'bos',
  'blik',
]

/** The amount as a row shows it: "2 pak", "500 g", "3", or nothing. */
export function useGroceryAmountText() {
  const { t, locale } = useI18n()
  return (quantity: number | undefined, unit: GroceryUnit | undefined) =>
    formatGroceryAmount(quantity, unit, locale, t.tasks.grocery.units)
}

/** Trailing a grocery row: the amount, tabular, in `ink`. */
export function GroceryAmount({ task }: { task: Task }) {
  const tokens = useTokens('kitchen')
  const amountText = useGroceryAmountText()
  const text = amountText(task.quantity, task.unit)
  if (!text) return null
  return (
    <Text
      testID={`amount-${task.id}`}
      style={[
        styles.amount,
        { color: task.done ? tokens.muted : tokens.ink },
      ]}
    >
      {text}
    </Text>
  )
}

/**
 * Under the composer while a line is typed: what the line will be saved as.
 * The amount is read here, on the phone, without AI and offline. The aisle is
 * the one the list itself would give the line (`useAisleOf`: the Group's own
 * choices, then the list's history, then the dictionary), the phone's
 * dictionary until that answer is in.
 *
 * The aisle chip opens the aisle menu (APP-524; `designs/groceries/README.md`,
 * "Recognition", 3): an aisle chosen there is the one the line is added in.
 * Untouched, the server decides the aisle as it always has.
 */
export function GroceryPreview({
  listId,
  line,
  aisle: chosen,
  onAisle,
}: {
  listId: string
  line: string
  /** The aisle a Member chose for this line, if any. */
  aisle: GroceryAisle | undefined
  onAisle: (aisle: GroceryAisle) => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.tasks.grocery
  const amountText = useGroceryAmountText()
  const typed = line.trim()
  const aisleOf = useAisleOf(group.slug, listId, typed ? [typed] : [])
  if (!typed) return null
  const fields = groceryAddFields(line)
  const amount = amountText(fields.quantity, fields.unit)
  const detected = aisleOf(typed)
  const aisle = chosen ?? detected
  const tint = tokens.tintOf('kitchen')
  const chip = [styles.chip, { backgroundColor: tint.wash, color: tint.text }]
  return (
    <View
      testID="grocery-preview"
      accessibilityLiveRegion="polite"
      style={styles.preview}
    >
      {amount ? <Text style={chip}>{amount}</Text> : null}
      <MenuView
        testID="grocery-preview-aisle"
        actions={GROCERY_AISLES.map((id) => ({
          id,
          title: words.aisles[id],
          state: id === aisle ? ('on' as const) : ('off' as const),
        }))}
        onPressAction={(event) => {
          const next = event.nativeEvent.event
          if (!isGroceryAisle(next) || next === aisle) return
          haptics.selectionChanged()
          onAisle(next)
        }}
      >
        <View
          accessibilityRole="button"
          accessibilityLabel={`${words.aisle}, ${words.aisles[aisle]}`}
          accessibilityHint={words.changeAisleHint}
          style={[styles.aisleChip, { backgroundColor: tint.wash }]}
        >
          <Text style={[styles.chipText, { color: tint.text }]}>
            {words.aisles[aisle]}
          </Text>
          <UI_ICONS.ChevronDown
            size={12}
            color={tint.text}
            strokeWidth={2.6}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      </MenuView>
      {amount || (chosen === undefined && detected !== 'other') ? (
        <Text style={[styles.hint, { color: tokens.muted }]}>
          {words.recognised}
        </Text>
      ) : null}
    </View>
  )
}

function amountDraft(quantity: number | undefined, locale: string): string {
  if (quantity === undefined) return ''
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(quantity)
}

/**
 * A typed amount as a number: digits with one optional decimal comma or
 * point, above zero and within bounds, rounded as stored. Anything else
 * ("1e3", "0x10", "") is not an amount.
 */
function parseAmount(text: string): number | undefined {
  const typed = text.trim()
  if (!/^\d+([.,]\d+)?$/.test(typed)) return undefined
  const value = Number(typed.replace(',', '.'))
  return isGroceryQuantity(value) ? roundGroceryQuantity(value) : undefined
}

/** The item screen's Amount and Aisle cards. */
export function GroceryFields({
  task,
  writable,
}: {
  task: Task
  writable: boolean
}) {
  const tokens = useTokens('kitchen')
  const { t, locale } = useI18n()
  const words = t.tasks.grocery
  const actions = useTaskActions()
  const [draft, setDraft] = useState(amountDraft(task.quantity, locale))

  // Somebody else's edit arrives while the field is not being typed in.
  useEffect(
    () => setDraft(amountDraft(task.quantity, locale)),
    [task.quantity, locale],
  )

  const write = (quantity: number | null, unit: GroceryUnit | null) => {
    haptics.selectionChanged()
    actions
      .setAmount(task.id, quantity, unit)
      .catch(() => haptics.actionFailed())
  }

  // What the field holds now, typed but maybe not yet committed: a step or a
  // unit tapped while typing starts from what was typed, not from before it.
  const current = () => parseAmount(draft) ?? task.quantity

  const step = (direction: 1 | -1) => {
    const next = stepGroceryQuantity(current(), task.unit, direction)
    if (next === null) return
    setDraft(amountDraft(next, locale))
    write(next, task.unit ?? null)
  }

  const commitDraft = () => {
    const typed = draft.trim()
    if (!typed) {
      if (task.quantity !== undefined) write(null, task.unit ?? null)
      return
    }
    const value = parseAmount(typed)
    if (value === undefined) {
      // Not an amount: put back the one that was there.
      setDraft(amountDraft(task.quantity, locale))
      haptics.actionFailed()
      return
    }
    const rounded = value
    setDraft(amountDraft(rounded, locale))
    if (rounded !== task.quantity) write(rounded, task.unit ?? null)
  }

  const canDecrease =
    writable && stepGroceryQuantity(current(), task.unit, -1) !== null
  const units =
    task.unit && !OFFERED_UNITS.includes(task.unit)
      ? [...OFFERED_UNITS, task.unit]
      : OFFERED_UNITS
  const selectedUnit = task.unit ?? (task.quantity === undefined ? null : 'stuks')
  const aisle: GroceryAisle = task.category ?? 'other'
  // A pill names the unit, as the design does: "stuks", "pak", "fles".
  const pillWord = (unit: GroceryUnit) =>
    unit === 'stuks' ? words.units[unit].other : words.units[unit].one
  const hasAmount = task.quantity !== undefined || task.unit !== undefined

  return (
    <>
      <Card>
        <View style={styles.headRow}>
          <Text style={[styles.label, { color: tokens.ink }]}>
            {words.amount}
          </Text>
          {hasAmount && writable ? (
            <Pressable
              testID="grocery-clear-amount"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                setDraft('')
                write(null, null)
              }}
            >
              <Text style={[styles.textButton, { color: tokens.accentText }]}>
                {words.clearAmount}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.stepper}>
          <StepButton
            testID="grocery-decrease"
            label={words.decrease}
            glyph="minus"
            disabled={!canDecrease}
            onPress={() => step(-1)}
          />
          <TextInput
            testID="grocery-quantity"
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            editable={writable}
            placeholder="1"
            placeholderTextColor={tokens.muted}
            accessibilityLabel={words.amount}
            accessibilityHint={
              task.unit ? words.units[task.unit].other : undefined
            }
            // Not `decimal-pad`: it has no return key on iPhone.
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.value, { color: tokens.ink }]}
          />
          <StepButton
            testID="grocery-increase"
            label={words.increase}
            glyph="plus"
            disabled={!writable}
            onPress={() => step(1)}
          />
        </View>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={words.unit}
          style={styles.units}
        >
          {units.map((unit) => {
            const on = unit === selectedUnit
            return (
              <Pressable
                key={unit}
                testID={`grocery-unit-${unit}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: !writable }}
                accessibilityLabel={pillWord(unit)}
                disabled={!writable}
                hitSlop={{ top: 5, bottom: 5 }}
                onPress={() => (on ? undefined : write(current() ?? 1, unit))}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: on ? tokens.ink : tokens.surface2,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: on ? tokens.onInk : tokens.ink },
                  ]}
                >
                  {pillWord(unit)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Card>
        <MenuView
          testID="grocery-aisle"
          actions={GROCERY_AISLES.map((id) => ({
            id,
            title: words.aisles[id],
            state: id === aisle ? ('on' as const) : ('off' as const),
            attributes: { disabled: !writable },
          }))}
          onPressAction={(event) => {
            const chosen = event.nativeEvent.event
            if (!isGroceryAisle(chosen) || chosen === aisle) return
            haptics.selectionChanged()
            actions
              .setAisle(task.id, chosen)
              .catch(() => haptics.actionFailed())
          }}
        >
          <View
            accessibilityRole="button"
            accessibilityLabel={`${words.aisle}, ${words.aisles[aisle]}`}
            style={styles.aisleRow}
          >
            <Text style={[styles.label, styles.grow, { color: tokens.ink }]}>
              {words.aisle}
            </Text>
            <Text style={[styles.aisleValue, { color: tokens.muted }]}>
              {words.aisles[aisle]}
            </Text>
            <UI_ICONS.ChevronDown
              size={16}
              color={tokens.muted}
              strokeWidth={2.2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
        </MenuView>
      </Card>
    </>
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
  const tokens = useTokens('kitchen')
  const Glyph = glyph === 'minus' ? UI_ICONS.Minus : UI_ICONS.Plus
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: tokens.surface2, opacity: disabled ? 0.4 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <Glyph size={20} color={tokens.ink} strokeWidth={2.4} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  amount: { ...TYPE.bodyStrong, ...TABULAR },
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACE[2],
    paddingLeft: SPACE[4] + 24 + SPACE[3],
    paddingRight: SPACE[4],
    paddingBottom: SPACE[3],
  },
  chip: {
    ...TYPE.footnoteStrong,
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: { ...TYPE.footnoteStrong },
  // A chip that opens a menu: the chip's look, with room for the chevron.
  aisleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  hint: { ...TYPE.footnote, flexBasis: '100%' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  label: { ...TYPE.body },
  grow: { flex: 1 },
  textButton: { ...TYPE.subhead },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[4],
    paddingVertical: SPACE[2],
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...TYPE.title2,
    ...TABULAR,
    minWidth: 88,
    minHeight: 44,
    textAlign: 'center',
    padding: 0,
  },
  units: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE[2],
    paddingTop: SPACE[2],
    paddingBottom: SPACE[1],
  },
  pill: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { ...TYPE.subhead },
  pressed: { opacity: 0.7 },
  aisleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: 48,
  },
  aisleValue: { ...TYPE.subhead },
})
