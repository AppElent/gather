import {
  addDays,
  localIsoDate,
  localMidnight,
  mondayStart,
} from '@gather/core/civil-date'
import {
  eligibleDinnerCandidates,
  randomDinner,
} from '@gather/core/meal-planner'
import { useMutation } from 'convex/react'
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { SearchField } from '../../components/SearchField'
import { SwipeableRow } from '../../components/SwipeableRow'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader, type WashSummary } from '../../ui/wash-header'
import { useTaskLists } from '../tasks/store'
import { TaskList } from '../tasks/TaskListScreen'

function KitchenShell({
  title,
  wash,
  children,
}: {
  title: string
  /** The group's wash, the Module's tile and a summary line on top. */
  wash?: { moduleId: string; summary: WashSummary }
  children: React.ReactNode
}) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const tile = wash ? moduleTile(wash.moduleId) : null
  if (wash && tile) {
    return (
      <>
        <Stack.Screen options={washScreenOptions(title)} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.ground }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={wash.summary}
          />
          <View style={styles.washContent}>{children}</View>
        </ScrollView>
      </>
    )
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {children}
      </ScrollView>
    </>
  )
}

function Composer({
  labels,
  onSave,
  initial,
}: {
  labels: { name: string; extra?: string; add: string }
  onSave: (name: string, extra?: string) => Promise<unknown>
  initial?: { name: string; extra?: string }
}) {
  const tokens = useTokens('kitchen')
  const [name, setName] = useState(initial?.name ?? '')
  const [extra, setExtra] = useState(initial?.extra ?? '')
  return (
    <View
      style={[
        styles.composer,
        { borderColor: tokens.hair, backgroundColor: tokens.surface },
      ]}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={labels.name}
        placeholderTextColor={tokens.muted}
        style={[
          styles.input,
          { color: tokens.ink, borderBottomColor: tokens.hair },
        ]}
      />
      {labels.extra ? (
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder={labels.extra}
          placeholderTextColor={tokens.muted}
          keyboardType="numeric"
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
      ) : null}
      <Pressable
        disabled={!name.trim()}
        onPress={() =>
          onSave(name, extra)
            .then(() => {
              setName('')
              setExtra('')
              haptics.itemSaved()
            })
            .catch(() => haptics.actionFailed())
        }
        style={[styles.add, { backgroundColor: tokens.accent }]}
      >
        <Text style={{ ...TYPE.bodyStrong, color: tokens.onAccent }}>
          {labels.add}
        </Text>
      </Pressable>
    </View>
  )
}

/** Dutch writes "maandag 21 sep"; as a label it wants only its first capital. */
const sentenceCase = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** "21–27 sep", or "28 sep – 4 okt" across a month, in the app's language. */
function weekRange(from: string, locale: string) {
  const start = localMidnight(from)
  const end = localMidnight(addDays(from, 6))
  const day = (date: Date) =>
    date.toLocaleDateString(locale, { day: 'numeric' })
  const dayMonth = (date: Date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  return start.getMonth() === end.getMonth()
    ? `${day(start)}–${dayMonth(end)}`
    : `${dayMonth(start)} – ${dayMonth(end)}`
}

export function MealPlannerScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('kitchen')
  const [weekStart, setWeekStart] = useState(() => mondayStart(localIsoDate()))
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [pickerLimit, setPickerLimit] = useState<10 | 20 | 30 | undefined>()
  const [editing, setEditing] = useState<Id<'mealEntries'> | null>(null)
  const from = weekStart
  const to = addDays(weekStart, 6)
  const data = useQuery(api.kitchen.overview, {
    groupSlug: group.slug,
    from,
    to,
  })
  const addMeal = useMutation(api.kitchen.addMealEntry)
  const updateMeal = useMutation(api.kitchen.updateMealEntry)
  const removeMeal = useMutation(api.kitchen.removeMealEntry)
  const confirmRemove = (entry: { _id: Id<'mealEntries'>; title: string }) =>
    confirmDestructive({
      title: fmt(t.kitchen.deleteTitle, { title: entry.title }),
      message: t.kitchen.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => removeMeal({ groupSlug: group.slug, id: entry._id }),
    })
  const setDinner = useMutation(api.kitchen.setDinner)
  const clearDinner = useMutation(api.kitchen.clearDinner)
  const candidates = useMemo(
    () => [
      ...(data?.mealEntries ?? []).map((entry) => ({
        id: entry._id,
        title: entry.title,
        prepMinutes: entry.prepMinutes,
        kind: 'meal' as const,
      })),
      ...(data?.recipes ?? []).map((recipe) => ({
        id: recipe._id,
        title: recipe.title,
        prepMinutes: recipe.prepMinutes,
        kind: 'recipe' as const,
      })),
    ],
    [data],
  )
  const choose = (
    date: string,
    candidate: (typeof candidates)[number],
    quickLimit?: 10 | 20 | 30,
  ) =>
    setDinner({
      groupSlug: group.slug,
      date,
      title: candidate.title,
      prepMinutes: candidate.prepMinutes,
      recipeId:
        candidate.kind === 'recipe'
          ? (candidate.id as Id<'recipes'>)
          : undefined,
      mealEntryId:
        candidate.kind === 'meal'
          ? (candidate.id as Id<'mealEntries'>)
          : undefined,
      quickLimit,
    })
  const fillWeek = async () => {
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      if (data?.dinners.some((row) => row.date === date)) continue
      const candidate = randomDinner(candidates) as
        | (typeof candidates)[number]
        | undefined
      if (candidate) await choose(date, candidate)
    }
    haptics.itemSaved()
  }
  const pickerDinner = pickerDate
    ? data?.dinners.find((row) => row.date === pickerDate)
    : undefined
  const pickerCandidates = eligibleDinnerCandidates(
    candidates,
    pickerLimit ?? pickerDinner?.quickLimit,
  ) as (typeof candidates)[number][]
  const [pickerQuery, setPickerQuery] = useState('')
  const closePicker = () => {
    setPickerDate(null)
    setPickerLimit(undefined)
    setPickerQuery('')
  }
  const query = pickerQuery.trim().toLocaleLowerCase(locale)
  const shownCandidates = query
    ? pickerCandidates.filter((candidate) =>
        candidate.title.toLocaleLowerCase(locale).includes(query),
      )
    : pickerCandidates
  return (
    <KitchenShell title={t.modules.byId['meal-planner'].label}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.kitchen.previousWeek}
          hitSlop={10}
          onPress={() => setWeekStart(addDays(weekStart, -7))}
          style={styles.navButton}
        >
          <UI_ICONS.ChevronLeft size={22} color={tokens.accentText} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.weekTitle, { color: tokens.ink }]}
        >
          {weekRange(weekStart, locale)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.kitchen.nextWeek}
          hitSlop={10}
          onPress={() => setWeekStart(addDays(weekStart, 7))}
          style={styles.navButton}
        >
          <UI_ICONS.ChevronRight size={22} color={tokens.accentText} />
        </Pressable>
      </View>
      <Pressable
        onPress={fillWeek}
        style={[styles.add, { backgroundColor: tokens.accent }]}
      >
        <Text style={{ color: tokens.onAccent }}>
          {t.kitchen.randomizeWeek}
        </Text>
      </Pressable>
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index)
        const dinner = data?.dinners.find((row) => row.date === date)
        return (
          <View
            key={date}
            style={[
              styles.row,
              { borderColor: tokens.hair, backgroundColor: tokens.surface },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              style={styles.dayMain}
              onPress={() => setPickerDate(date)}
            >
              <Text style={[styles.dayName, { color: tokens.ink }]}>
                {sentenceCase(
                  localMidnight(date).toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  }),
                )}
              </Text>
              <Text
                style={{
                  ...TYPE.subhead,
                  color: dinner ? tokens.ink : tokens.muted,
                }}
              >
                {dinner?.title ?? t.kitchen.nothingPlanned}
              </Text>
            </Pressable>
            <View style={styles.inline}>
              {/* One labelled control instead of three bare numbers. With no
                  dinner yet, a limit opens the picker already filtered. */}
              <NativeContextMenu
                trigger="press"
                actions={[
                  ...([10, 20, 30] as const).map((limit) => ({
                    id: String(limit),
                    title: fmt(t.kitchen.quick, { minutes: limit }),
                    state:
                      dinner?.quickLimit === limit
                        ? ('on' as const)
                        : ('off' as const),
                  })),
                  ...(dinner?.quickLimit
                    ? [{ id: 'none', title: t.kitchen.noTimeLimit }]
                    : []),
                ]}
                onAction={(action) => {
                  const limit =
                    action === 'none'
                      ? undefined
                      : (Number(action) as 10 | 20 | 30)
                  if (!dinner) {
                    setPickerLimit(limit)
                    setPickerDate(date)
                    return
                  }
                  setDinner({
                    groupSlug: group.slug,
                    date,
                    title: dinner.title,
                    prepMinutes: dinner.prepMinutes,
                    recipeId: dinner.recipeId,
                    mealEntryId: dinner.mealEntryId,
                    quickLimit: limit,
                  })
                }}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel={t.kitchen.timeLimit}
                  style={[
                    styles.limitChip,
                    {
                      backgroundColor: dinner?.quickLimit
                        ? tokens.surface2
                        : 'transparent',
                    },
                  ]}
                >
                  <UI_ICONS.Clock
                    size={16}
                    color={dinner?.quickLimit ? tokens.ink : tokens.muted}
                  />
                  {dinner?.quickLimit ? (
                    <Text
                      style={{
                        ...TYPE.footnote,
                        ...TABULAR,
                        color: tokens.ink,
                      }}
                    >
                      {fmt(t.kitchen.quickShort, {
                        minutes: dinner.quickLimit,
                      })}
                    </Text>
                  ) : null}
                </View>
              </NativeContextMenu>
              {dinner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.kitchen.clearDinner}
                  hitSlop={8}
                  onPress={() => clearDinner({ groupSlug: group.slug, date })}
                  style={styles.clear}
                >
                  <UI_ICONS.X size={18} color={tokens.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )
      })}
      <Text style={[styles.section, { color: tokens.ink }]}>
        {t.kitchen.mealLibrary}
      </Text>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.prepMinutes,
          add: t.common.actions.add,
        }}
        onSave={(title, prep) =>
          addMeal({
            groupSlug: group.slug,
            title,
            prepMinutes: Number(prep) || undefined,
          })
        }
      />
      {data?.mealEntries.map((entry) => (
        <NativeContextMenu
          key={entry._id}
          actions={[
            { id: 'edit', title: t.common.actions.edit },
            {
              id: 'delete',
              title: t.common.actions.delete,
              attributes: { destructive: true },
            },
          ]}
          onAction={(action) => {
            if (action === 'edit') setEditing(entry._id)
            else confirmRemove(entry)
          }}
        >
          <SwipeableRow
            deleteLabel={t.common.actions.delete}
            onDelete={() => confirmRemove(entry)}
          >
            <Pressable
              onPress={() => setEditing(entry._id)}
              style={[
                styles.row,
                { borderColor: tokens.hair, backgroundColor: tokens.surface },
              ]}
            >
              <Text style={[styles.title, { color: tokens.ink }]}>
                {entry.title}
              </Text>
              <Text style={{ color: tokens.muted }}>{entry.prepMinutes}</Text>
            </Pressable>
          </SwipeableRow>
        </NativeContextMenu>
      ))}
      {pickerDate !== null ? (
        // The app's system sheet: drag to dismiss, a title, a close button.
        <NativeSheet
          title={t.kitchen.chooseDinner}
          subtitle={
            pickerLimit
              ? fmt(t.kitchen.quick, { minutes: pickerLimit })
              : undefined
          }
          onClose={closePicker}
          maxHeight={0.8}
          fill
        >
          <SearchField
            tone="inset"
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder={t.kitchen.searchDinners}
            clearAccessibilityLabel={t.search.clear}
          />
          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pickerList}
          >
            {shownCandidates.length === 0 ? (
              <Text style={[styles.pickerEmpty, { color: tokens.muted }]}>
                {t.kitchen.noMatches}
              </Text>
            ) : null}
            {shownCandidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                onPress={() => {
                  choose(
                    pickerDate,
                    candidate,
                    pickerLimit ?? pickerDinner?.quickLimit,
                  )
                  closePicker()
                  haptics.selectionChanged()
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { borderBottomColor: tokens.hair },
                  pressed && { backgroundColor: tokens.surface2 },
                ]}
              >
                <Text style={[styles.title, { color: tokens.ink }]}>
                  {candidate.title}
                </Text>
                {candidate.prepMinutes ? (
                  <Text style={{ color: tokens.muted }}>
                    {fmt(t.kitchen.minutes, {
                      minutes: candidate.prepMinutes,
                    })}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </NativeSheet>
      ) : null}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {editing ? (
          <EditMeal
            id={editing}
            entries={data?.mealEntries ?? []}
            onSave={(id, title, prepMinutes) =>
              updateMeal({
                groupSlug: group.slug,
                id,
                title,
                prepMinutes,
              }).then(() => setEditing(null))
            }
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </KitchenShell>
  )
}

function EditMeal({
  id,
  entries,
  onSave,
  onClose,
}: {
  id: Id<'mealEntries'>
  entries: readonly {
    _id: Id<'mealEntries'>
    title: string
    prepMinutes?: number
  }[]
  onSave: (
    id: Id<'mealEntries'>,
    title: string,
    prepMinutes?: number,
  ) => Promise<unknown>
  onClose: () => void
}) {
  const entry = entries.find((item) => item._id === id)
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const [title, setTitle] = useState(entry?.title ?? '')
  const [prep, setPrep] = useState(String(entry?.prepMinutes ?? ''))
  return (
    <View style={styles.modal}>
      <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <TextInput
          value={prep}
          onChangeText={setPrep}
          keyboardType="numeric"
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <Pressable onPress={() => onSave(id, title, Number(prep) || undefined)}>
          <Text style={{ color: tokens.accentText }}>
            {t.common.actions.save}
          </Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={{ color: tokens.muted }}>{t.common.actions.cancel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

export function GroceriesScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('kitchen')
  const data = useQuery(api.kitchen.overview, { groupSlug: group.slug })
  const set = useMutation(api.kitchen.setGroceryList)
  const lists = useTaskLists()
  const selected = data?.groceryListId
  if (selected)
    return (
      <TaskList
        listId={selected}
        moduleId="groceries"
        addPlaceholder={t.kitchen.addGroceryItem}
        menuExtras={[
          {
            // Unlinking is not destructive — the list stays in Tasks — and it
            // lands on the picker below, so it needs no confirmation.
            id: 'change-grocery-list',
            title: t.kitchen.changeList,
            image: 'arrow.left.arrow.right',
            onPress: () => set({ groupSlug: group.slug, listId: null }),
          },
        ]}
      />
    )
  return (
    <KitchenShell
      title={t.modules.byId.groceries.label}
      wash={{
        moduleId: 'groceries',
        summary: {
          count: plural(locale, lists?.length ?? 0, t.tasks.count.lists),
          scope: group.name,
        },
      }}
    >
      <Text style={[TYPE.subhead, { color: tokens.muted }]}>
        {t.kitchen.noGroceryList}
      </Text>
      {lists && lists.length > 0 ? (
        <InsetList>
          {lists.map((list) => (
            <InsetRow
              key={list._id}
              title={list.name}
              onPress={() =>
                set({ groupSlug: group.slug, listId: list._id }).then(() =>
                  haptics.selectionChanged(),
                )
              }
            />
          ))}
        </InsetList>
      ) : null}
    </KitchenShell>
  )
}

export function PantryScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('kitchen')
  const data = useQuery(api.kitchen.overview, { groupSlug: group.slug })
  const add = useMutation(api.kitchen.addPantryEntry)
  const update = useMutation(api.kitchen.updatePantryEntry)
  const remove = useMutation(api.kitchen.removePantryEntry)
  const confirmRemove = (item: { _id: Id<'pantryEntries'>; title: string }) =>
    confirmDestructive({
      title: fmt(t.kitchen.deleteTitle, { title: item.title }),
      message: t.kitchen.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => remove({ groupSlug: group.slug, id: item._id }),
    })
  const [editing, setEditing] = useState<Id<'pantryEntries'> | null>(null)
  const entry = data?.pantry.find((item) => item._id === editing)
  return (
    <KitchenShell title={t.modules.byId.pantry.label}>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.quantity,
          add: t.common.actions.add,
        }}
        onSave={(title, quantity) =>
          add({ groupSlug: group.slug, title, quantity })
        }
      />
      {data?.pantry.length === 0 ? (
        <Text style={{ color: tokens.muted }}>{t.kitchen.noPantry}</Text>
      ) : (
        data?.pantry.map((item) => (
          <NativeContextMenu
            key={item._id}
            actions={[
              { id: 'edit', title: t.common.actions.edit },
              {
                id: 'delete',
                title: t.common.actions.delete,
                attributes: { destructive: true },
              },
            ]}
            onAction={(action) =>
              action === 'edit' ? setEditing(item._id) : confirmRemove(item)
            }
          >
            <SwipeableRow
              deleteLabel={t.common.actions.delete}
              onDelete={() => confirmRemove(item)}
            >
              <Pressable
                onPress={() => setEditing(item._id)}
                style={[
                  styles.row,
                  {
                    borderColor: tokens.hair,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Text style={[styles.title, { color: tokens.ink }]}>
                  {item.title}
                </Text>
                <Text style={{ color: tokens.muted }}>{item.quantity}</Text>
              </Pressable>
            </SwipeableRow>
          </NativeContextMenu>
        ))
      )}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {entry ? (
          <PantryEditor
            entry={entry}
            onSave={(title, quantity) =>
              update({
                groupSlug: group.slug,
                id: entry._id,
                title,
                quantity,
              }).then(() => setEditing(null))
            }
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </KitchenShell>
  )
}

function PantryEditor({
  entry,
  onSave,
  onClose,
}: {
  entry: { title: string; quantity?: string }
  onSave: (title: string, quantity?: string) => Promise<unknown>
  onClose: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const [title, setTitle] = useState(entry.title)
  const [quantity, setQuantity] = useState(entry.quantity ?? '')
  return (
    <View style={styles.modal}>
      <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <Pressable onPress={() => onSave(title, quantity)}>
          <Text style={{ color: tokens.accentText }}>
            {t.common.actions.save}
          </Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>{t.common.actions.cancel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  washContent: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 10,
    gap: 8,
  },
  input: {
    ...TYPE.body,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  add: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
  },
  row: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { ...TYPE.bodyStrong, flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navButton: { padding: 8 },
  weekTitle: { ...TYPE.bodyStrong, textAlign: 'center', flex: 1 },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  clear: { padding: 6 },
  dayMain: { flex: 1, gap: 2, paddingVertical: 10 },
  dayName: { ...TYPE.footnoteStrong },
  pickerList: { paddingBottom: 40 },
  pickerEmpty: { padding: 24, textAlign: 'center' },
  pickerRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  section: { ...TYPE.bodyStrong, marginTop: 8 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: {
    padding: 20,
    gap: 12,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.card,
  },
})
