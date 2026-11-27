/**
 * Several grocery lists, one per store (APP-313; `designs/groceries/README.md`
 * section 6): the store pill under the list's summary, and the Grocery lists
 * sheet it opens.
 *
 * The sheet's rows are radio rows: picking one opens that list at once, and
 * Done only closes. Under them, the open list's aisle order and a new grocery
 * list, which is the Tasks New list sheet with Groceries already chosen.
 */
import { isDefaultAisleOrder } from '@gather/core/groceries'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { NativeSheet } from '../../components/NativeSheet'
import type { api } from '../../convex/api'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, useInsetSeparator } from '../../ui/inset-list'
import { ModuleTile } from '../../ui/module-tile'
import { radioProps } from '../../ui/radio-props'
import { onShoppingList } from './groceryList'
import { useTasksOf } from './store'

type ListRow = FunctionReturnType<typeof api.taskLists.list>[number]

/** The `surface` pill with the store glyph, the list's name and a chevron. */
export function StorePill({
  name,
  onPress,
}: {
  name: string
  onPress: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  return (
    <Pressable
      testID="grocery-store-pill"
      accessibilityRole="button"
      accessibilityLabel={fmt(t.tasks.grocery.lists.switchLabel, { list: name })}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: pressed ? tokens.surface2 : tokens.surface },
      ]}
    >
      <UI_ICONS.Store
        size={16}
        color={tokens.ink}
        strokeWidth={2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text numberOfLines={1} style={[styles.pillLabel, { color: tokens.ink }]}>
        {name}
      </Text>
      <UI_ICONS.ChevronDown
        size={14}
        color={tokens.muted}
        strokeWidth={2.4}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

export function GroceryListsSheet({
  lists,
  selectedId,
  onChoose,
  onAisleOrder,
  onNewList,
  onClose,
}: {
  /** The Group's grocery lists, in order (`groceryListsOf`). */
  lists: readonly ListRow[]
  selectedId: string | undefined
  onChoose: (listId: string) => void
  /** Opens the aisle order of the selected list. */
  onAisleOrder: () => void
  onNewList: () => void
  onClose: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t, locale } = useI18n()
  const words = t.tasks.grocery.lists
  const local = useMemo(
    () => lists.filter((list) => list.provider === 'local'),
    [lists],
  )
  const { tasks, today } = useTasksOf(local)
  const open = (listId: string) =>
    tasks.filter(
      (task) => task.listId === listId && onShoppingList(task, today),
    ).length
  const selected = lists.find((list) => list._id === selectedId)

  return (
    <NativeSheet
      title={words.title}
      onClose={onClose}
      background="ground"
      doneBar
    >
      <View style={styles.body}>
        <View accessibilityRole="radiogroup" accessibilityLabel={words.title}>
          <InsetList>
            {lists.map((list) => (
              <ListRadio
                key={list._id}
                name={list.name}
                subtitle={
                  isDefaultAisleOrder(list.aisleOrder)
                    ? words.defaultOrder
                    : words.customOrder
                }
                count={list.provider === 'local' ? open(list._id) : null}
                countLabel={
                  list.provider === 'local'
                    ? plural(locale, open(list._id), words.count)
                    : null
                }
                selected={list._id === selectedId}
                onPress={() => {
                  if (list._id !== selectedId) haptics.selectionChanged()
                  onChoose(list._id)
                }}
              />
            ))}
          </InsetList>
        </View>

        <InsetList>
          {selected && selected.provider === 'local' ? (
            <ActionRow
              testID="grocery-lists-aisle-order"
              glyph={UI_ICONS.ArrowDownUp}
              glyphColor={tokens.ink}
              label={fmt(words.aisleOrderOf, { list: selected.name })}
              chevron
              onPress={onAisleOrder}
            />
          ) : null}
          <ActionRow
            testID="grocery-lists-new"
            glyph={UI_ICONS.Plus}
            glyphColor={tokens.accentText}
            label={words.newList}
            onPress={onNewList}
          />
        </InsetList>

        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {words.footnote}
        </Text>
      </View>
    </NativeSheet>
  )
}

function ListRadio({
  name,
  subtitle,
  count,
  countLabel,
  selected,
  onPress,
}: {
  name: string
  subtitle: string
  /** The bare number, as drawn; `countLabel` says it in words to VoiceOver. */
  count: number | null
  countLabel: string | null
  selected: boolean
  onPress: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const separator = useInsetSeparator()
  return (
    <Pressable
      testID={`grocery-list-${name}`}
      {...radioProps(selected, t.a11y.radioButton)}
      accessibilityLabel={[name, subtitle, countLabel].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <ModuleTile group="kitchen" glyph={MODULE_ICONS.ShoppingCart} size="s" />
      <View style={[styles.rowText, separator]}>
        <View style={styles.words}>
          <Text style={[styles.name, { color: tokens.ink }]}>{name}</Text>
          <Text style={[styles.sub, { color: tokens.muted }]}>
            {subtitle}
          </Text>
        </View>
        {count !== null ? (
          <Text style={[styles.count, { color: tokens.muted }]}>{count}</Text>
        ) : null}
        <View style={styles.check}>
          {selected ? (
            <UI_ICONS.Check
              size={20}
              color={tokens.accentText}
              strokeWidth={2.6}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

function ActionRow({
  glyph: Glyph,
  glyphColor,
  label,
  chevron = false,
  onPress,
  testID,
}: {
  glyph: (typeof UI_ICONS)['Plus']
  glyphColor: string
  label: string
  chevron?: boolean
  onPress: () => void
  testID: string
}) {
  const tokens = useTokens()
  const separator = useInsetSeparator()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View style={styles.actionGlyph}>
        <Glyph
          size={22}
          color={glyphColor}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <View style={[styles.rowText, styles.actionText, separator]}>
        <Text style={[styles.name, styles.words, { color: tokens.ink }]}>
          {label}
        </Text>
        {chevron ? (
          <UI_ICONS.ChevronRight
            size={16}
            color={tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 32,
    maxWidth: '100%',
    paddingLeft: SPACE[3],
    paddingRight: 10,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillLabel: { ...TYPE.subhead, fontWeight: '600', flexShrink: 1 },
  body: { gap: SPACE[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  rowText: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 6,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
  },
  actionText: { minHeight: SIZE.rowMin },
  actionGlyph: { width: SIZE.tileS, alignItems: 'center' },
  words: { flex: 1 },
  name: { ...TYPE.body },
  count: { ...TYPE.subhead, ...TABULAR },
  check: { width: 20, alignItems: 'center' },
  sub: { ...TYPE.footnote },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
})
