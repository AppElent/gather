/**
 * The top of a Module screen with no photo (`components/WashHeader`): the
 * group's wash behind the native large title, then the Module's `tile-l` and
 * a one-line summary.
 *
 * It is the first thing *inside* the screen's scroll view, never above it: the
 * scroll view has to stay the screen's first subview for the large title to
 * collapse. The wash itself is an absolutely positioned view that reaches far
 * above its box (`WASH_OVERSCROLL`), so it sits behind the transparent header
 * and runs into the pull-down overscroll. The screen sets
 * `washScreenOptions(title)`; the title, back button and bar buttons are the
 * system's.
 *
 * Text on the wash is `ink` and `muted` only, never a group's `text`.
 */
import { StyleSheet, Text, View } from 'react-native'

import type { Glyph } from '../theme/glyph'
import {
  type ModuleGroup,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../theme/tokens'
import { ModuleTile } from './module-tile'
import { WASH_OVERSCROLL } from './screen-header'

export interface WashSummary {
  /** The count, in `ink` 700: "4 open", "12 recipes". */
  count: string
  /** What the count is of, in `muted`: the Group, a list, a child. */
  scope?: string
}

export function WashHeader({
  group,
  glyph,
  summary,
}: {
  group: ModuleGroup
  glyph: Glyph
  summary: WashSummary
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf(group)

  return (
    <View style={styles.wrap}>
      <View
        pointerEvents="none"
        style={[styles.wash, { backgroundColor: tint.wash }]}
      />
      <View style={styles.row}>
        <ModuleTile group={group} glyph={glyph} size="l" />
        <Text
          testID="wash-summary"
          style={[styles.summary, { color: tokens.ink }]}
        >
          <Text style={styles.count}>{summary.count}</Text>
          {summary.scope ? (
            <Text style={{ color: tokens.muted }}>{` · ${summary.scope}`}</Text>
          ) : null}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACE[4],
    paddingTop: SPACE[3],
    paddingBottom: SPACE[5],
    // Lists start `space-4` below the wash, on `ground`.
    marginBottom: SPACE[4],
  },
  wash: {
    position: 'absolute',
    top: -WASH_OVERSCROLL,
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  summary: { ...TYPE.subhead, flex: 1 },
  count: { ...TABULAR, fontWeight: '700' },
})
