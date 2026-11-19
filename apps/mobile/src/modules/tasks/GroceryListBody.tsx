/**
 * A grocery list's body (APP-310; `designs/groceries/README.md`, "1. List"):
 * the action row, the open items in aisle sections in the default walking
 * order, the composer, and the Checked row with Put back.
 *
 * A checked item stays where it is for a moment, so a mistaken tap can be
 * tapped back, and then leaves its aisle for Checked. Checked holds what was
 * checked since the last "Clear checked"; everything checked stays in Recent.
 *
 * The action row opens Recent (on a list Gather can write to) and In stock
 * (APP-314). Shopping mode and the
 * suggestion strip (APP-315, 311) have no slot here yet: they arrive with
 * their own issues.
 */
import { useRouter } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import type { Glyph } from '../../theme/glyph'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { CompletedSection } from '../../ui/completed-section'
import { InsetList } from '../../ui/inset-list'
import { moduleHref } from '../moduleDestination'
import { aisleSections, inCheckedSection } from './groceryList'
import { useTaskActions } from './store'
import type { Task, TaskList } from './types'

export function GroceryListBody({
  list,
  tasks,
  row,
  composer,
  empty,
  lingering,
  onUndoable,
}: {
  list: TaskList
  tasks: readonly Task[]
  /**
   * Items just checked that still stand in their aisle (`useLingering`); the
   * screen owns them, so its summary and Clear checked count agree.
   */
  lingering: ReadonlySet<string>
  /** One item as a row, the same row every list draws. */
  row: (task: Task) => ReactNode
  /** The add row, or nothing on a list Gather cannot write to. */
  composer: ReactNode
  /** What the list says with nothing on it. */
  empty: ReactNode
  /** Shows a message with Undo, outside the scroll view. */
  onUndoable: (message: string, undo: () => void) => void
}) {
  const tokens = useTokens('kitchen')
  const { t, locale } = useI18n()
  const router = useRouter()
  const actions = useTaskActions()
  const [busy, setBusy] = useState(false)
  const g = t.tasks.grocery

  const open = tasks.filter((task) => !task.done || lingering.has(task.id))
  const checked = tasks.filter(
    (task) =>
      !lingering.has(task.id) && inCheckedSection(task, list.checkedClearedAt),
  )
  const sections = aisleSections(open)

  const putBackAll = () => {
    const ids = checked.map((task) => task.id)
    setBusy(true)
    actions
      .setDoneInList(list.id, false, ids)
      .then((changed) => {
        haptics.itemSaved()
        onUndoable(plural(locale, changed.length, g.putBackDone), () => {
          void actions
            .setDoneInList(list.id, true, changed)
            .catch(() => haptics.actionFailed())
        })
      })
      .catch(() => haptics.actionFailed())
      .finally(() => setBusy(false))
  }

  return (
    <>
      <View style={styles.actions}>
        {/* Recent puts items back onto this list, so a list Gather cannot
            write to (a linked one) has no Recent, as it has no composer. */}
        {list.writable ? (
          <ActionPill
            testID="grocery-recent"
            glyph={UI_ICONS.Clock}
            label={g.recent.title}
            onPress={() =>
              router.push(
                moduleHref('/all/groceries/recent', { listId: list.id }),
              )
            }
          />
        ) : null}
        <ActionPill
          testID="grocery-in-stock"
          glyph={UI_ICONS.House}
          label={t.kitchen.inStock.title}
          onPress={() => router.push(moduleHref('/all/groceries/in-stock'))}
        />
      </View>

      {sections.map(({ aisle, tasks: rows }) => (
        <View key={aisle} style={styles.section} testID={`aisle-${aisle}`}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={plural(locale, rows.length, {
              one: fmt(g.aisleSection.one, { aisle: g.aisles[aisle] }),
              other: fmt(g.aisleSection.other, { aisle: g.aisles[aisle] }),
            })}
            style={styles.sectionHead}
          >
            <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
              {g.aisles[aisle]}
            </Text>
            <Text style={[styles.sectionAside, { color: tokens.muted }]}>
              {rows.length}
            </Text>
          </View>
          <InsetList>{rows.map(row)}</InsetList>
        </View>
      ))}

      <InsetList>
        {open.length === 0 && checked.length === 0 ? empty : null}
        {composer}
      </InsetList>

      <CompletedSection
        count={checked.length}
        group="kitchen"
        label={g.checked}
        testID="grocery-checked"
        action={
          list.writable
            ? {
                label: g.putBackAll,
                accessibilityLabel: plural(
                  locale,
                  checked.length,
                  g.putBackAllLabel,
                ),
                onPress: putBackAll,
                disabled: busy,
                testID: 'grocery-put-back-all',
              }
            : undefined
        }
      >
        <InsetList>{checked.map(row)}</InsetList>
      </CompletedSection>
    </>
  )
}

/** A pill in the action row: a glyph and a word, on the surface. */
function ActionPill({
  testID,
  glyph: Icon,
  label,
  onPress,
}: {
  testID: string
  glyph: Glyph
  label: string
  onPress: () => void
}) {
  const tokens = useTokens('kitchen')
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: pressed ? tokens.surface2 : tokens.surface,
          borderColor: tokens.hair,
        },
      ]}
    >
      <Icon
        size={18}
        color={tokens.ink}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.pillLabel, { color: tokens.ink }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  pill: {
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[4],
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillLabel: { ...TYPE.body },
  section: { gap: SPACE[2] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACE[2],
    paddingHorizontal: SPACE[1],
  },
  sectionLabel: { ...TYPE.footnoteStrong, flexShrink: 1 },
  sectionAside: { ...TYPE.footnote, ...TABULAR },
})
