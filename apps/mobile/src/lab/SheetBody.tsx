/**
 * What every variant puts inside itself, so the only difference between them is
 * the mechanism. Deleted with the rest of `src/lab/`.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTokens } from '../theme/tokens'
import {
  CONTENT_LABELS,
  CONTENT_WATCH,
  type ContentKind,
  SheetContent,
} from './sheetContent'

export function SheetBody({
  kind,
  title,
  watch,
  fill = true,
}: {
  kind: ContentKind
  title: string
  watch: string
  /** `false` for the fit-to-contents sheet, which measures its child and cannot take `flex: 1`. */
  fill?: boolean
}) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.host,
        fill && styles.fill,
        { backgroundColor: tokens.surface, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* One view, not three siblings, and `collapsable={false}` so Fabric
          cannot flatten it back into three. A `formSheet` resizes a ScrollView
          inside it to the detent, and to do that `react-native-screens` needs
          the sheet's content to be at most [header, ScrollView] — more than
          that and it cannot tell which subview is the header, warns, and skips
          the resize. Which would mean the Long list variant measured a layout
          bug rather than the sheet. */}
      <View collapsable={false} style={styles.header}>
        <Text style={[styles.title, { color: tokens.fg }]}>{title}</Text>
        <Text style={[styles.watch, { color: tokens.muted }]}>{watch}</Text>
        <Text style={[styles.watch, { color: tokens.muted }]}>
          {CONTENT_LABELS[kind]} — {CONTENT_WATCH[kind]}
        </Text>
      </View>
      <SheetContent kind={kind} fill={fill} />
    </View>
  )
}

const styles = StyleSheet.create({
  host: { paddingHorizontal: 18, paddingTop: 14, gap: 6 },
  header: { gap: 6 },
  fill: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  watch: { fontSize: 13, lineHeight: 18 },
})
