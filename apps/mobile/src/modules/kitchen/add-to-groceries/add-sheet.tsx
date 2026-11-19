/**
 * The add-to-groceries sheet (APP-312, `designs/groceries/README.md`
 * section 5, `Recipe.dc.html`): a source card with the servings stepper and
 * the list it goes to, a checkbox row per line with its amount and why it
 * reads that way, and one Kitchen button that puts the ticked lines on the
 * list, merged with what is already there.
 *
 * Source-agnostic: the recipe sheet hands in its ingredients; the week menu
 * (APP-321) can hand in a week's lines, without a stepper, the same way.
 */
import { MenuView } from '@expo/ui/community/menu'
import {
  formatGroceryAmount,
  type GroceryAmount,
} from '@gather/core/groceries'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { NativeContextMenu } from '../../../components/NativeContextMenu'
import { NativeSheet } from '../../../components/NativeSheet'
import { api, type Id } from '../../../convex/api'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import {
  lastGroceryListKey,
  readPreference,
  writePreference,
} from '../../../prefs/localPreference'
import type { Glyph } from '../../../theme/glyph'
import { UI_ICONS } from '../../../theme/icons'
import {
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { ModuleTile } from '../../../ui/module-tile'
import { SectionLabel } from '../../../ui/section-label'
import { useTaskList, useTaskLists } from '../../tasks/store'
import {
  editedRead,
  type LineRead,
  type PickRow,
  pickRows,
  type RowMeta,
  type SourceLine,
} from './pick'
import type { AiCount } from './use-recipe-lines'

export interface AddSheetSource {
  /** "Shakshuka met feta": the card's title, and the note on the list. */
  title: string
  subtitle: string
  glyph: Glyph
}

export function AddToGroceriesSheet({
  source,
  lines,
  servings,
  aiCount,
  preferredListId,
  onClose,
}: {
  source: AddSheetSource
  lines: readonly SourceLine[]
  /** The stepper, when the source scales (a recipe; not the week menu). */
  servings?: { value: number; onChange: (value: number) => void }
  aiCount: AiCount | null
  /** The list the sheet was opened from, if any. */
  preferredListId?: string
  onClose: () => void
}) {
  const tokens = useTokens('kitchen')
  const kitchen = tokens.tintOf('kitchen')
  const { t, locale } = useI18n()
  const words = t.tasks.grocery.addLines
  const { group } = useGroup()
  const add = useMutation(api.groceryLines.add)

  // The grocery lists Gather can write to; the sheet opens on the one last
  // used on this phone (APP-313), then the first.
  const allLists = useTaskLists()
  const lists = useMemo(
    () =>
      (allLists ?? []).filter(
        (list) => list.grocery && list.provider === 'local' && list.writable,
      ),
    [allLists],
  )
  const [chosenListId, setChosenListId] = useState<string>()
  const listId = [
    chosenListId,
    preferredListId,
    readPreference(lastGroceryListKey(group.slug)) ?? undefined,
  ]
    .concat(lists.map((list) => list._id))
    .find((id) => id && lists.some((list) => list._id === id))
  const list = lists.find((candidate) => candidate._id === listId)
  const { tasks } = useTaskList(listId ?? '')

  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [edits, setEdits] = useState<Record<string, LineRead>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [rowWidth, setRowWidth] = useState<number>()

  const shown = lines.map((line) =>
    edits[line.key] ? { ...line, read: edits[line.key] } : line,
  )
  const pick = pickRows({
    lines: shown,
    servings: servings?.value,
    items: tasks,
    ticks,
  })
  const count = pick.lines.length

  const amountText = (amount: GroceryAmount) =>
    formatGroceryAmount(
      amount.quantity,
      amount.unit,
      locale,
      t.tasks.grocery.units,
    )
  // "10", not nothing: the merge line names both amounts.
  const amountOrOne = (amount: GroceryAmount) => amountText(amount) ?? '1'

  const metaText = (meta: RowMeta | null): string | null => {
    if (!meta) return null
    switch (meta.kind) {
      case 'merge':
        return fmt(words.merge, {
          from: amountOrOne(meta.from),
          to: amountOrOne(meta.to),
        })
      case 'already':
        return words.alreadyOn
      case 'inStock':
        return meta.adding ? words.inStockAdding : words.inStock
      case 'ai':
        return meta.earlier || !aiCount
          ? words.readWithAiEarlier
          : fmt(words.readWithAi, {
              used: String(aiCount.used),
              limit: String(aiCount.limit),
            })
      case 'reading':
        return words.reading
      case 'text':
        return words.asText
    }
  }

  const toggle = (row: PickRow) => {
    haptics.selectionChanged()
    setTicks((current) => ({ ...current, [row.key]: !row.on }))
  }

  const edit = (row: PickRow) => {
    const typed = [amountText(row.amount), row.title].filter(Boolean).join(' ')
    Alert.prompt(
      words.editTitle,
      undefined,
      [
        { text: t.common.actions.cancel, style: 'cancel' },
        {
          text: t.common.actions.save,
          onPress: (value?: string) => {
            const text = value?.trim()
            if (!text) return
            setEdits((current) => ({ ...current, [row.key]: editedRead(text) }))
            setTicks((current) => ({ ...current, [row.key]: true }))
          },
        },
      ],
      'plain-text',
      typed,
    )
  }

  const submit = async () => {
    if (!listId || count === 0) return
    setBusy(true)
    setFailed(false)
    try {
      await add({
        groupSlug: group.slug,
        listId: listId as Id<'taskLists'>,
        source: source.title,
        lines: pick.lines,
      })
      writePreference(lastGroceryListKey(group.slug), listId)
      haptics.itemSaved()
      onClose()
    } catch {
      haptics.actionFailed()
      setFailed(true)
      setBusy(false)
    }
  }

  const Updown = UI_ICONS.ChevronsUpDown
  const separator = { borderTopColor: tokens.hair }
  const listRow = (
    <View
      accessibilityRole="button"
      accessibilityLabel={`${words.toList}, ${list?.name ?? words.noList}`}
      style={styles.cardRow}
    >
      <Text style={[styles.body, styles.grow, { color: tokens.ink }]}>
        {words.toList}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.body, styles.listName, { color: tokens.muted }]}
      >
        {list?.name ?? words.noList}
      </Text>
      <Updown
        size={16}
        color={tokens.muted}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  )

  return (
    <NativeSheet
      title={words.title}
      onClose={onClose}
      maxHeight={0.92}
      fill
      background="ground"
      cancelBar
      footer={
        <View style={styles.footer}>
          {failed ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.footnote, { color: tokens.danger }]}
            >
              {words.failed}
            </Text>
          ) : null}
          <Button
            testID="add-to-groceries"
            group="kitchen"
            label={plural(locale, count, words.add)}
            busy={busy}
            disabled={!listId || count === 0 || pick.reading}
            onPress={submit}
          />
          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {words.footnote}
          </Text>
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <View style={styles.sourceRow}>
            <ModuleTile group="kitchen" glyph={source.glyph} size="m" />
            <View style={styles.grow}>
              <Text style={[styles.sourceTitle, { color: tokens.ink }]}>
                {source.title}
              </Text>
              <Text style={[styles.footnote, { color: tokens.muted }]}>
                {source.subtitle}
              </Text>
            </View>
          </View>
          {servings ? (
            <View style={[styles.cardRow, styles.separated, separator]}>
              <Text style={[styles.body, styles.grow, { color: tokens.ink }]}>
                {words.servings}
              </Text>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel={words.servings}
                accessibilityValue={{ text: String(servings.value) }}
                accessibilityActions={[
                  { name: 'increment' },
                  { name: 'decrement' },
                ]}
                onAccessibilityAction={(event) => {
                  const step = event.nativeEvent.actionName === 'increment' ? 1 : -1
                  servings.onChange(Math.max(1, servings.value + step))
                }}
                style={[styles.stepper, { backgroundColor: tokens.surface2 }]}
              >
                <StepButton
                  testID="servings-fewer"
                  label={words.fewer}
                  glyph="minus"
                  disabled={servings.value <= 1}
                  onPress={() => {
                    haptics.selectionChanged()
                    servings.onChange(Math.max(1, servings.value - 1))
                  }}
                />
                <Text
                  testID="servings-value"
                  style={[styles.servings, { color: tokens.ink }]}
                >
                  {servings.value}
                </Text>
                <StepButton
                  testID="servings-more"
                  label={words.more}
                  glyph="plus"
                  disabled={servings.value >= 99}
                  onPress={() => {
                    haptics.selectionChanged()
                    servings.onChange(Math.min(99, servings.value + 1))
                  }}
                />
              </View>
            </View>
          ) : null}
          <View
            style={[styles.separated, separator]}
            onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
          >
            {rowWidth == null ? (
              listRow
            ) : (
              // The menu sizes itself to its children: give the row its width.
              <MenuView
                testID="groceries-to-list"
                shouldOpenOnLongPress={false}
                onOpenMenu={() => haptics.menuOpened()}
                actions={lists.map((candidate) => ({
                  id: candidate._id,
                  title: candidate.name,
                  state:
                    candidate._id === listId
                      ? ('on' as const)
                      : ('off' as const),
                }))}
                onPressAction={(event) => {
                  haptics.selectionChanged()
                  setChosenListId(event.nativeEvent.event)
                }}
              >
                <View style={{ width: rowWidth }}>{listRow}</View>
              </MenuView>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>{words.ingredients}</SectionLabel>
          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            {pick.rows.map((row, index) => {
              // "1" for one onion: the sheet says how many it adds.
              const amount =
                row.amount.quantity === undefined
                  ? amountText(row.amount)
                  : amountOrOne(row.amount)
              const meta = metaText(row.meta)
              const strong = row.meta?.kind === 'merge' && row.on
              return (
                <NativeContextMenu
                  key={row.key}
                  actions={[{ id: 'edit', title: words.edit, image: 'pencil' }]}
                  onAction={() => edit(row)}
                >
                  <Pressable
                    testID={`groceries-line-${row.key}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: row.on }}
                    accessibilityLabel={[row.title, amount, meta]
                      .filter(Boolean)
                      .join(', ')}
                    accessibilityActions={[{ name: 'longpress', label: words.edit }]}
                    onAccessibilityAction={() => edit(row)}
                    onPress={() => toggle(row)}
                    style={({ pressed }) => [
                      styles.line,
                      pressed && { backgroundColor: tokens.surface2 },
                    ]}
                  >
                    <View
                      style={[
                        styles.box,
                        {
                          borderColor: row.on ? kitchen.text : tokens.muted,
                          backgroundColor: row.on ? kitchen.text : 'transparent',
                        },
                      ]}
                    >
                      {row.on ? (
                        <UI_ICONS.Check
                          size={14}
                          color={tokens.ground}
                          strokeWidth={3.2}
                        />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.lineContent,
                        index > 0 && [styles.separated, separator],
                      ]}
                    >
                      <View style={styles.grow}>
                        <Text
                          style={[
                            styles.body,
                            { color: row.on ? tokens.ink : tokens.muted },
                          ]}
                        >
                          {row.title}
                        </Text>
                        {meta ? (
                          <Text
                            style={[
                              strong ? styles.footnoteStrong : styles.footnote,
                              { color: tokens.muted },
                            ]}
                          >
                            {meta}
                          </Text>
                        ) : null}
                      </View>
                      {amount ? (
                        <Text
                          style={[
                            styles.amount,
                            { color: row.on ? tokens.ink : tokens.muted },
                          ]}
                        >
                          {amount}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </NativeContextMenu>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </NativeSheet>
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { opacity: disabled ? 0.4 : 1 },
        pressed && { backgroundColor: tokens.hair },
      ]}
    >
      <Glyph size={18} color={tokens.ink} strokeWidth={2.6} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: SPACE[4], paddingBottom: SPACE[4] },
  card: { borderRadius: RADIUS.card, paddingLeft: SPACE[4], overflow: 'hidden' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: 64,
    paddingRight: 14,
  },
  sourceTitle: { ...TYPE.bodyStrong },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: SIZE.rowMin,
    paddingRight: SPACE[3],
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0 },
  body: { ...TYPE.body },
  footnote: { ...TYPE.footnote },
  footnoteStrong: { ...TYPE.footnoteStrong },
  listName: { flexShrink: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    padding: 2,
    borderRadius: RADIUS.pill,
  },
  step: {
    width: SIZE.hitMin,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servings: { ...TYPE.title2, ...TABULAR, minWidth: 28, textAlign: 'center' },
  section: { gap: SPACE[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 6,
    paddingRight: SPACE[4],
  },
  amount: { ...TYPE.bodyStrong, ...TABULAR },
  footer: { gap: 6, paddingTop: SPACE[2] },
})
