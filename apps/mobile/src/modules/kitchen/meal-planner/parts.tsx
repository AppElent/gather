/**
 * The small pieces the week, the meal sheet, Pick and Plan mijn week share: a
 * meal's 46 pt thumb, the empty slot's dashed tile, the row of Member coins,
 * the toggle chip, and the week's Boodschappen pill.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../../feedback/haptics'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { RecordThumb } from '../../../ui/record-thumb'
import type { Member } from './week'

/**
 * A recipe's photo; a recipe without one is `kitchen-wash` with a book; a
 * quick meal is `surface-2` with a bolt.
 */
export function MealThumb({
  imageUrl,
  quick,
}: {
  imageUrl?: string | null
  quick: boolean
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf('kitchen')
  if (imageUrl)
    return (
      <RecordThumb uri={imageUrl} group="kitchen" glyph={UI_ICONS.BookOpen} />
    )
  const Icon = quick ? UI_ICONS.Bolt : UI_ICONS.BookOpen
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.thumb,
        { backgroundColor: quick ? tokens.surface2 : tint.wash },
      ]}
    >
      <Icon size={20} color={quick ? tokens.muted : tint.text} strokeWidth={2} />
    </View>
  )
}

export function EmptyThumb() {
  const tokens = useTokens()
  const tint = tokens.tintOf('kitchen')
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.thumb, styles.dashed, { borderColor: tint.text }]}
    >
      <UI_ICONS.Plus size={20} color={tint.text} strokeWidth={2.2} />
    </View>
  )
}

/** One coin per Member; one who does not eat along is a dashed, struck ring. */
export function MemberCoins({
  members,
  eaters,
  label,
  size = 22,
}: {
  members: readonly Member[]
  eaters: readonly string[]
  /** The whole group's one accessibility label. */
  label: string
  size?: number
}) {
  const tokens = useTokens()
  const eating = new Set(eaters)
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={styles.coins}
      testID="meal-coins"
    >
      {members.map((member) => {
        const on = eating.has(member.userId)
        return (
          <Coin
            key={member.userId}
            name={member.name}
            on={on}
            size={size}
            color={on ? tokens.ink : tokens.muted}
            background={on ? tokens.surface2 : 'transparent'}
            border={on ? 'transparent' : tokens.muted}
          />
        )
      })}
    </View>
  )
}

export function Coin({
  name,
  on,
  size,
  color,
  background,
  border,
}: {
  name: string
  on: boolean
  size: number
  color: string
  background: string
  border: string
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.coin,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderColor: border,
          borderStyle: on ? 'solid' : 'dashed',
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={[
          size > 24 ? styles.initialLarge : styles.initial,
          { color },
          !on && styles.struck,
        ]}
      >
        {name.trim().charAt(0).toLocaleUpperCase() || '?'}
      </Text>
    </View>
  )
}

/** A toggle chip: ink when on, with a check. */
export function Chip({
  label,
  on,
  testID,
  icon: Icon,
  onPress,
}: {
  label: string
  on: boolean
  testID: string
  icon?: (typeof UI_ICONS)[keyof typeof UI_ICONS]
  onPress: () => void
}) {
  const tokens = useTokens()
  const color = on ? tokens.onInk : tokens.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      testID={testID}
      onPress={() => {
        haptics.selectionChanged()
        onPress()
      }}
      style={({ pressed }) => [
        styles.chip,
        on
          ? { backgroundColor: tokens.ink, borderColor: tokens.ink }
          : { backgroundColor: tokens.surface, borderColor: tokens.hair },
        pressed && styles.pressed,
      ]}
    >
      {on ? (
        <UI_ICONS.Check size={14} color={color} strokeWidth={2.6} />
      ) : Icon ? (
        <Icon size={14} color={color} strokeWidth={2.2} />
      ) : null}
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

/**
 * The week's Boodschappen pill. The label is explicit and the cart is hidden
 * from VoiceOver: without that, iOS reads the SF Symbol's name first
 * ("winkelwagen, Boodschappen", APP-461).
 */
export function GroceriesPill({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="meal-planner-groceries"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.groceriesPill,
        { backgroundColor: tokens.surface },
        pressed && styles.pressed,
      ]}
    >
      <UI_ICONS.Cart
        size={18}
        color={tokens.ink}
        strokeWidth={2}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text
        maxFontSizeMultiplier={2}
        style={[styles.groceriesLabel, { color: tokens.ink }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Plan mijn week has its own row: beside Boodschappen its label only fits
  // at a smaller size, even on a 6.3" phone.
  groceriesPill: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACE[4],
    flexGrow: 1,
  },
  groceriesLabel: { ...TYPE.body },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    paddingHorizontal: SPACE[3],
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipLabel: { ...TYPE.footnoteStrong },
  pressed: { opacity: 0.7 },
  thumb: {
    width: SIZE.thumb,
    height: SIZE.thumb,
    borderRadius: RADIUS.thumb,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  coins: { flexDirection: 'row', gap: 3 },
  coin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initial: { ...TYPE.footnoteStrong, lineHeight: undefined },
  initialLarge: { ...TYPE.bodyStrong, lineHeight: undefined },
  struck: { textDecorationLine: 'line-through' },
})
