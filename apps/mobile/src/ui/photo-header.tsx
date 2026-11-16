/**
 * The top of a record that has a photo (`components/PhotoHeader`): the photo
 * full-bleed under the transparent native header and its glass buttons, then
 * an eyebrow (the Module's `tile-xs` and a line in the group's `text`) and the
 * `record-title`. This is the one place a title is drawn in content.
 *
 * Nothing is laid on the photo — no text, no glass label, no scrim — and a
 * record without a photo does not come here: it uses `WashHeader`, never a
 * placeholder picture.
 *
 * The screen's scroll view keeps `contentInsetAdjustmentBehavior="automatic"`
 * and the photo pulls itself up by the header's height, so it starts under the
 * status bar. Not `"never"`: native tabs turn that back into `"automatic"` on
 * the screens they attach (`overrideScrollViewContentInsetAdjustmentBehavior`),
 * depending on mount timing, which left a band above the photo. The screen
 * also wires `usePhotoTitle()`, so the native inline title appears only once
 * this one has scrolled under the bar.
 */
import { Image } from 'expo-image'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { useCallback, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { Glyph } from '../theme/glyph'
import { type ModuleGroup, SPACE, TYPE, useTokens } from '../theme/tokens'
import { ModuleTile } from './module-tile'
import { inlineTitleShown, PHOTO_HEIGHT } from './screen-header'

/**
 * Whether the native inline title should show yet, from the scroll position
 * and where the in-content title ends. The state changes only when the answer
 * does, so scrolling does not re-render the screen on every frame.
 */
export function usePhotoTitle() {
  const headerHeight = useHeaderHeight()
  const [titleBottom, setTitleBottom] = useState<number | null>(null)
  const [shown, setShown] = useState(false)

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = inlineTitleShown(
        event.nativeEvent.contentOffset.y,
        titleBottom,
        headerHeight,
      )
      setShown((current) => (current === next ? current : next))
    },
    [titleBottom, headerHeight],
  )

  return {
    shown,
    /** The in-content title has laid out, so the scroll view is mounted. */
    laidOut: titleBottom !== null,
    onScroll,
    onTitleBottom: setTitleBottom,
  }
}

export function PhotoHeader({
  photo,
  group,
  glyph,
  eyebrow,
  title,
  onTitleBottom,
}: {
  photo: { uri: string; alt: string }
  group: ModuleGroup
  glyph: Glyph
  /** The Module's name and the author, from `@gather/core`. */
  eyebrow: string
  title: string
  /** The title's bottom edge in scroll-content coordinates. */
  onTitleBottom?: (bottom: number) => void
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf(group)
  const headerHeight = useHeaderHeight()

  // Content starts below the header's inset; the photo starts `headerHeight`
  // above that, so the title's bottom is measured from there.
  const onLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    onTitleBottom?.(PHOTO_HEIGHT - headerHeight + y + height)
  }

  return (
    <View style={{ marginTop: -headerHeight }}>
      <Image
        source={{ uri: photo.uri }}
        style={[styles.photo, { backgroundColor: tokens.surface2 }]}
        contentFit="cover"
        accessibilityLabel={photo.alt}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.text}>
        <View style={styles.eyebrow}>
          <ModuleTile group={group} glyph={glyph} size="xs" />
          <Text style={[styles.eyebrowText, { color: tint.text }]}>
            {eyebrow}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          onLayout={onLayout}
          style={[styles.title, { color: tokens.ink }]}
        >
          {title}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: PHOTO_HEIGHT },
  text: {
    paddingHorizontal: SPACE[4],
    paddingTop: SPACE[4],
    gap: SPACE[1],
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  eyebrowText: { ...TYPE.footnoteStrong, flex: 1 },
  title: { ...TYPE.recordTitle },
})
