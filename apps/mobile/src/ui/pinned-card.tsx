/**
 * A pinned record or list on Home, in a horizontally scrolling row
 * (`components/PinnedCard`).
 *
 * - **Photo card:** the photo 104 high, the title in `body-strong` on
 *   `surface` under it. Nothing laid over the photo.
 * - **Fill card:** the group's fill, a 30 pt glyph top left and the label in
 *   `card-label` and the group's `on` colour bottom left. The label wraps; the
 *   card is at least `pinned-min-height` and grows with Dynamic Type. A word
 *   too long for the card shrinks rather than breaking mid-word.
 *
 * Holding a card opens the native context menu (Unpin, Open), whose actions
 * the caller supplies. No counts and no badges.
 */
import type { MenuAction } from '@expo/ui/community/menu'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeContextMenu } from '../components/NativeContextMenu'
import type { Glyph } from '../theme/glyph'
import {
  type ModuleGroup,
  RADIUS,
  SIZE,
  SPACE,
  TYPE,
  useTokens,
} from '../theme/tokens'

/** The photo's height on a photo card. */
const PINNED_PHOTO_HEIGHT = 104
/** The glyph on a fill card. */
const PINNED_GLYPH = 30

export type PinnedCardFace =
  | { photo: string }
  | { group: ModuleGroup; glyph: Glyph }

export function PinnedCard({
  title,
  face,
  onPress,
  menu,
  testID,
}: {
  title: string
  face: PinnedCardFace
  onPress: () => void
  menu?: { actions: readonly MenuAction[]; onAction: (id: string) => void }
  testID?: string
}) {
  const tokens = useTokens()

  let body: ReactNode
  let background: string
  if ('photo' in face) {
    background = tokens.surface
    body = (
      <>
        <Image
          source={{ uri: face.photo }}
          style={[styles.photo, { backgroundColor: tokens.surface2 }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <Text style={[styles.photoTitle, { color: tokens.ink }]}>{title}</Text>
      </>
    )
  } else {
    const tint = tokens.tintOf(face.group)
    const Icon = face.glyph
    background = tint.fill
    body = (
      <View style={styles.fill}>
        <Icon
          size={PINNED_GLYPH}
          color={tint.on}
          strokeWidth={2}
          weight="medium"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text
          // One line per word at most, shrinking to fit: a long compound
          // ("Babylogboek") gets smaller rather than split mid-word.
          numberOfLines={wordCount(title)}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.label, { color: tint.on }]}
        >
          {title}
        </Text>
      </View>
    )
  }

  const card = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  )

  if (!menu) return card
  return (
    <NativeContextMenu actions={menu.actions} onAction={menu.onAction}>
      {card}
    </NativeContextMenu>
  )
}

function wordCount(text: string): number {
  return Math.max(1, text.trim().split(/\s+/).length)
}

/**
 * The Pinned row: scrolls sideways and bleeds to the screen edges, with the
 * gutter as its content inset.
 */
export function PinnedRow({
  children,
  accessibilityLabel,
}: {
  children: ReactNode
  accessibilityLabel?: string
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  card: {
    width: SIZE.pinnedWidth,
    minHeight: SIZE.pinnedMinHeight,
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: PINNED_PHOTO_HEIGHT },
  photoTitle: {
    ...TYPE.bodyStrong,
    paddingHorizontal: SPACE[2],
    paddingVertical: SPACE[2],
  },
  fill: {
    flex: 1,
    padding: SPACE[3],
    justifyContent: 'space-between',
    gap: SPACE[3],
  },
  label: { ...TYPE.cardLabel },
  // Buttons may dim; a card is a button here.
  pressed: { opacity: 0.85 },
  row: {
    paddingHorizontal: SPACE[4],
    // `space-2` + 2, the gap the design system sets between pinned cards.
    gap: SPACE[2] + 2,
  },
})
