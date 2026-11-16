/**
 * Today's timed events on one time axis (`components/TodayRail`): what
 * happened, then where now is.
 *
 * - **Grid:** a time column (at least 44 wide, `footnote`, tabular,
 *   right-aligned), the `tile-s` column with a 1.5 pt `hair` spine through it,
 *   then the content.
 * - **Past items:** a `surface-2` tile with a `muted` glyph at full opacity,
 *   and one `subhead` `muted` line. Never a faded row.
 * - **Now:** an `ink` capsule with `on-ink` text, centred on the spine.
 *   Decorative for VoiceOver: the header's date already says when this is.
 * - **Accessibility sizes:** the time stacks above its line.
 *
 * Only past items are built. The design's upcoming items (a group-fill tile,
 * a title and a thumbnail) need timed data no live Module has yet, so they
 * are left out rather than drawn empty.
 */
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import type { Glyph } from '../theme/glyph'
import {
  type ModuleGroup,
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../theme/tokens'
import { ModuleTile } from './module-tile'
import { isAccessibilityTextSize } from './text-scale'

export interface RailItem {
  id: string
  /** `HH:MM`, 24-hour. */
  time: string
  group: ModuleGroup
  glyph: Glyph
  /** One line: "Bottle · 120 ml · Sanne". */
  title: string
}

/** The time column's minimum width; it grows with the text. */
const TIME_MIN_WIDTH = 44
/** The spine's width. */
const SPINE = 1.5

export function TodayRail({
  items,
  now,
  testID,
}: {
  /** Past items, oldest first. */
  items: readonly RailItem[]
  /** The capsule's words: "Now · 11:32". */
  now: string
  testID?: string
}) {
  const tokens = useTokens()
  const { fontScale } = useWindowDimensions()
  const stacked = isAccessibilityTextSize(fontScale)

  const spine = (first: boolean, last: boolean) => (
    <View
      style={[
        styles.spine,
        {
          backgroundColor: tokens.hair,
          top: first ? '50%' : 0,
          bottom: last ? '50%' : 0,
        },
      ]}
    />
  )

  const time = (text: string, hidden = false) => (
    <Text
      style={[
        styles.time,
        stacked ? styles.timeStacked : styles.timeColumn,
        { color: tokens.muted },
        hidden && styles.hidden,
      ]}
    >
      {text}
    </Text>
  )

  return (
    <View testID={testID}>
      {items.map((item, index) => (
        <View
          key={item.id}
          accessible
          accessibilityLabel={`${item.time}, ${item.title}`}
          style={styles.row}
        >
          {stacked ? null : time(item.time)}
          <View style={styles.tileColumn}>
            {spine(index === 0, false)}
            <ModuleTile group={item.group} glyph={item.glyph} size="s" past />
          </View>
          <View style={styles.content}>
            {stacked ? time(item.time) : null}
            <Text style={[styles.title, { color: tokens.muted }]}>
              {item.title}
            </Text>
          </View>
        </View>
      ))}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.row, styles.nowRow]}
      >
        {/* An invisible time keeps the capsule on the same spine as the rows
            above, however wide Dynamic Type has made the time column. */}
        {stacked ? null : time('00:00', true)}
        <View style={styles.nowColumn}>
          <View style={styles.nowSpine}>
            {spine(items.length === 0, true)}
          </View>
          <View style={[styles.capsule, { backgroundColor: tokens.ink }]}>
            <Text style={[styles.capsuleText, { color: tokens.onInk }]}>
              {now}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: SPACE[3],
    minHeight: SIZE.hitMin,
  },
  time: { ...TYPE.footnote, ...TABULAR },
  timeColumn: {
    minWidth: TIME_MIN_WIDTH,
    textAlign: 'right',
    alignSelf: 'center',
  },
  timeStacked: { paddingTop: SPACE[2] },
  hidden: { opacity: 0 },
  tileColumn: {
    width: SIZE.tileS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spine: {
    position: 'absolute',
    width: SPINE,
    left: (SIZE.tileS - SPINE) / 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: SPACE[2],
  },
  title: { ...TYPE.subhead },
  nowRow: { minHeight: 40 },
  nowColumn: { flex: 1, justifyContent: 'center' },
  nowSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIZE.tileS,
  },
  capsule: {
    alignSelf: 'flex-start',
    // Starts just left of the spine, as the design draws it.
    marginLeft: -SPACE[2],
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE[3],
    paddingVertical: 5,
  },
  capsuleText: { ...TYPE.footnoteStrong, ...TABULAR, fontWeight: '700' },
})
