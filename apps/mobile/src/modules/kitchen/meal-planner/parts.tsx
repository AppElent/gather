/**
 * The small pieces the week, the meal sheet and Pick share: a meal's 46 pt
 * thumb, the empty slot's dashed tile, and the row of Member coins.
 */
import { StyleSheet, Text, View } from 'react-native'

import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, TYPE, useTokens } from '../../../theme/tokens'
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

const styles = StyleSheet.create({
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
