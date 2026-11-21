/**
 * The grouped list every record collection uses (`components/InsetList`):
 * rounded `surface` sections on `ground`.
 *
 * - **Section.** `surface`, the card corner, `space-4` either side.
 * - **Rows.** At least `row-min` (52), 56 with a subtitle. The 0.5 pt `hair`
 *   separator starts at the text column, not under the leading glyph. A row
 *   fills on press; holding it opens its context menu; swiping left reveals
 *   Delete (`SwipeableRow`). A row's own swipe-right verb (completing a task)
 *   stays with the row that has one.
 * - **Never** a tinted row, a coloured quantity or a group fill behind a
 *   section. The leading slot holds a check ring, a `tile-s`, a thumbnail or
 *   nothing; colour lives only in that tile.
 *
 * Rows learn whether they are first from the section, so a run of rows draws
 * one separator between each pair and none above the first. A custom row
 * reads the same through `useInsetRowFirst()`.
 */
import type { MenuAction } from '@expo/ui/community/menu'
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  use,
} from 'react'
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

import { NativeContextMenu } from '../components/NativeContextMenu'
import { SwipeableRow } from '../components/SwipeableRow'
import { UI_ICONS } from '../theme/icons'
import {
  type ModuleGroup,
  RADIUS,
  SIZE,
  SPACE,
  TYPE,
  useTokens,
} from '../theme/tokens'

/** 56 pt: a row with a subtitle. */
const ROW_WITH_SUBTITLE = 56

const FirstInSection = createContext(true)

/** Whether this row is the first in its section, and so draws no separator. */
export function useInsetRowFirst(): boolean {
  return use(FirstInSection)
}

export function InsetList({
  children,
  accessibilityLabel,
  style,
  testID,
}: {
  children: ReactNode
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const tokens = useTokens()
  const rows = Children.toArray(children).filter(Boolean)

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.section, { backgroundColor: tokens.surface }, style]}
    >
      {rows.map((row, index) => (
        // Keyed by the row's own key, not its place: a row that comes or goes
        // above another (an empty-list note above the composer) must not
        // remount it, or the focused composer loses its keyboard (APP-521).
        <FirstInSection
          key={isValidElement(row) && row.key !== null ? row.key : index}
          value={index === 0}
        >
          {row}
        </FirstInSection>
      ))}
    </View>
  )
}

/**
 * One row of a section inside a virtualized list (`FlatList`), where a single
 * `InsetList` cannot wrap every row: it draws its slice of the section — the
 * top corners on the first row, the bottom corners on the last — and tells the
 * row whether it is first.
 */
export function InsetListItem({
  index,
  count,
  children,
}: {
  index: number
  count: number
  children: ReactNode
}) {
  const tokens = useTokens()
  const first = index === 0
  const last = index === count - 1
  return (
    <View
      style={[
        styles.slice,
        { backgroundColor: tokens.surface },
        first && styles.sliceFirst,
        last && styles.sliceLast,
      ]}
    >
      <FirstInSection value={first}>{children}</FirstInSection>
    </View>
  )
}

/** The hairline above a row's text column, unless it is the first. */
export function useInsetSeparator(): ViewStyle {
  const tokens = useTokens()
  const first = useInsetRowFirst()
  return first
    ? {}
    : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hair }
}

export function InsetRow({
  title,
  subtitle,
  subtitleTone = 'muted',
  leading,
  trailing,
  chevron = false,
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
  menu,
  onDelete,
  deleteLabel,
}: {
  title?: string
  subtitle?: string
  /** `danger` (600) when the subtitle says something is due or overdue. */
  subtitleTone?: 'muted' | 'danger'
  /** A check ring, a `tile-s`, a thumbnail, or nothing. */
  leading?: ReactNode
  /** An assignee coin, a due word, a count. */
  trailing?: ReactNode
  /** Draws the disclosure chevron after `trailing`. */
  chevron?: boolean
  /** The text column, when a title and subtitle are not enough. */
  children?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link' | 'none'
  testID?: string
  /** The hold menu. */
  menu?: { actions: readonly MenuAction[]; onAction: (id: string) => void }
  /** Swipe left reveals a Delete that must be tapped. */
  onDelete?: () => void
  deleteLabel?: string
}) {
  const tokens = useTokens()
  const separator = useInsetSeparator()
  const hasSubtitle = Boolean(subtitle)

  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View
        style={[
          styles.content,
          { minHeight: hasSubtitle ? ROW_WITH_SUBTITLE : SIZE.rowMin },
          separator,
        ]}
      >
        <View style={styles.text}>
          {title ? (
            <Text style={[styles.title, { color: tokens.ink }]}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text
              style={[
                subtitleTone === 'danger' ? styles.dangerSub : styles.subtitle,
                {
                  color:
                    subtitleTone === 'danger' ? tokens.danger : tokens.muted,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
          {children}
        </View>
        {trailing}
        {chevron ? (
          <UI_ICONS.ChevronRight
            size={17}
            color={tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
    </>
  )

  const row = onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={
        accessibilityLabel ??
        // The subtitle is part of what the row says (due, author, count).
        ([title, subtitle].filter(Boolean).join(', ') || undefined)
      }
      android_ripple={{ color: tokens.surface2 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface },
        // iOS fills the row; Android's ripple draws its own.
        pressed &&
          Platform.OS !== 'android' && { backgroundColor: tokens.surface2 },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      testID={testID}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { backgroundColor: tokens.surface }]}
    >
      {content}
    </View>
  )

  const swipeable =
    onDelete && deleteLabel ? (
      <SwipeableRow deleteLabel={deleteLabel} onDelete={onDelete}>
        {row}
      </SwipeableRow>
    ) : (
      row
    )

  // The menu wraps the outside of the swipeable, so the system lifts a view
  // Reanimated is not moving (see `TaskRow`).
  if (!menu) return swipeable
  return (
    <NativeContextMenu actions={menu.actions} onAction={menu.onAction}>
      {swipeable}
    </NativeContextMenu>
  )
}

/**
 * The last row of a list that adds to it: a plus in the group's `text` colour
 * and a `muted` label.
 */
export function InsetAddRow({
  group,
  label,
  onPress,
  testID,
}: {
  group: ModuleGroup
  label: string
  onPress: () => void
  testID?: string
}) {
  const tokens = useTokens()
  return (
    <InsetRow
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      leading={
        <UI_ICONS.Plus
          size={20}
          color={tokens.tintOf(group).text}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      }
    >
      <Text style={[styles.title, { color: tokens.muted }]}>{label}</Text>
    </InsetRow>
  )
}

/** The leading column's width for a 24 pt check ring or a 28 pt tile. */
export const INSET_LEADING_GAP = SPACE[3]

const styles = StyleSheet.create({
  section: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  slice: { marginHorizontal: SPACE[4], overflow: 'hidden' },
  sliceFirst: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  sliceLast: {
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACE[4],
  },
  leading: { marginRight: INSET_LEADING_GAP, alignItems: 'center' },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    paddingRight: SPACE[4],
    paddingVertical: SPACE[2],
  },
  text: { flex: 1, gap: 2 },
  title: { ...TYPE.body },
  subtitle: { ...TYPE.footnote },
  dangerSub: { ...TYPE.footnoteStrong },
})
