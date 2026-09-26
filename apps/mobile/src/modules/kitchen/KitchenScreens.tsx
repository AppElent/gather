import {
  eligibleDinnerCandidates,
  randomDinner,
} from '@gather/core/meal-planner'
import { useMutation, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { SearchField } from '../../components/SearchField'
import { SwipeableRow } from '../../components/SwipeableRow'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { useTaskState } from '../tasks/store'
import { TaskList } from '../tasks/TaskListScreen'

const iso = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}
const monday = (date: Date) => addDays(date, -((date.getDay() + 6) % 7))

function KitchenShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
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
        { borderColor: tokens.border, backgroundColor: tokens.surface },
      ]}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={labels.name}
        placeholderTextColor={tokens.muted}
        style={[styles.input, { color: tokens.fg }]}
      />
      {labels.extra ? (
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder={labels.extra}
          placeholderTextColor={tokens.muted}
          keyboardType="numeric"
          style={[styles.input, { color: tokens.fg }]}
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
        <Text style={{ color: tokens.onAccent, fontWeight: '700' }}>
          {labels.add}
        </Text>
      </Pressable>
    </View>
  )
}

function ConfirmDelete(
  labels: { cancel: string; delete: string },
  {
    title,
    body,
    onDelete,
  }: {
    title: string
    body: string
    onDelete: () => void
  },
) {
  Alert.alert(title, body, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.delete, style: 'destructive', onPress: onDelete },
  ])
  return null
}

/** Dutch writes "maandag 21 sep"; as a label it wants only its first capital. */
const sentenceCase = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** "21–27 sep", or "28 sep – 4 okt" across a month, in the app's language. */
function weekRange(start: Date, locale: string) {
  const end = addDays(start, 6)
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
  const [weekStart, setWeekStart] = useState(() => monday(new Date()))
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [pickerLimit, setPickerLimit] = useState<10 | 20 | 30 | undefined>()
  const [editing, setEditing] = useState<Id<'mealEntries'> | null>(null)
  const from = iso(weekStart)
  const to = iso(addDays(weekStart, 6))
  const data = useQuery(api.kitchen.overview, {
    groupSlug: group.slug,
    from,
    to,
  })
  const addMeal = useMutation(api.kitchen.addMealEntry)
  const updateMeal = useMutation(api.kitchen.updateMealEntry)
  const removeMeal = useMutation(api.kitchen.removeMealEntry)
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
      const date = iso(addDays(weekStart, i))
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
          <UI_ICONS.ChevronLeft size={22} color={tokens.accent} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.weekTitle, { color: tokens.fg }]}
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
          <UI_ICONS.ChevronRight size={22} color={tokens.accent} />
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
        const date = iso(addDays(weekStart, index))
        const dinner = data?.dinners.find((row) => row.date === date)
        return (
          <View
            key={date}
            style={[
              styles.row,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              style={styles.dayMain}
              onPress={() => setPickerDate(date)}
            >
              <Text style={[styles.dayName, { color: tokens.fg }]}>
                {sentenceCase(
                  new Date(`${date}T12:00`).toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  }),
                )}
              </Text>
              <Text
                style={{
                  color: dinner ? tokens.fg : tokens.muted,
                  fontSize: 15,
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
                        ? tokens.tile
                        : 'transparent',
                    },
                  ]}
                >
                  <UI_ICONS.Clock
                    size={16}
                    color={dinner?.quickLimit ? tokens.accent : tokens.muted}
                  />
                  {dinner?.quickLimit ? (
                    <Text style={{ color: tokens.accent, fontSize: 13 }}>
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
      <Text style={[styles.section, { color: tokens.fg }]}>
        {t.kitchen.mealLibrary}
      </Text>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.prepMinutes,
          add: t.kitchen.add,
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
            { id: 'edit', title: t.actions.edit },
            {
              id: 'delete',
              title: t.actions.delete,
              attributes: { destructive: true },
            },
          ]}
          onAction={(action) => {
            if (action === 'edit') setEditing(entry._id)
            else
              ConfirmDelete(t.actions, {
                title: fmt(t.kitchen.deleteTitle, { title: entry.title }),
                body: t.kitchen.deleteBody,
                onDelete: () =>
                  removeMeal({ groupSlug: group.slug, id: entry._id }),
              })
          }}
        >
          <SwipeableRow
            deleteLabel={t.actions.delete}
            onDelete={() =>
              ConfirmDelete(t.actions, {
                title: fmt(t.kitchen.deleteTitle, { title: entry.title }),
                body: t.kitchen.deleteBody,
                onDelete: () =>
                  removeMeal({ groupSlug: group.slug, id: entry._id }),
              })
            }
          >
            <Pressable
              onPress={() => setEditing(entry._id)}
              style={[
                styles.row,
                { borderColor: tokens.border, backgroundColor: tokens.surface },
              ]}
            >
              <Text style={[styles.title, { color: tokens.fg }]}>
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
                  { borderBottomColor: tokens.border },
                  pressed && { backgroundColor: tokens.tile },
                ]}
              >
                <Text style={[styles.title, { color: tokens.fg }]}>
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
          style={[styles.input, { color: tokens.fg }]}
        />
        <TextInput
          value={prep}
          onChangeText={setPrep}
          keyboardType="numeric"
          style={[styles.input, { color: tokens.fg }]}
        />
        <Pressable onPress={() => onSave(id, title, Number(prep) || undefined)}>
          <Text style={{ color: tokens.accent }}>{t.actions.save}</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={{ color: tokens.muted }}>{t.actions.cancel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

export function GroceriesScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const data = useQuery(api.kitchen.overview, { groupSlug: group.slug })
  const set = useMutation(api.kitchen.setGroceryList)
  const state = useTaskState()
  const selected = data?.groceryListId
  if (selected)
    return (
      <TaskList
        listId={selected}
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
    <KitchenShell title={t.modules.byId.groceries.label}>
      <Text>{t.kitchen.noGroceryList}</Text>
      {state.lists.map((list) => (
        <Pressable
          key={list.id}
          style={styles.row}
          onPress={() =>
            set({
              groupSlug: group.slug,
              listId: list.id as Id<'taskLists'>,
            }).then(() => haptics.selectionChanged())
          }
        >
          <Text>{list.name}</Text>
        </Pressable>
      ))}
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
  const [editing, setEditing] = useState<Id<'pantryEntries'> | null>(null)
  const entry = data?.pantry.find((item) => item._id === editing)
  return (
    <KitchenShell title={t.modules.byId.pantry.label}>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.quantity,
          add: t.kitchen.add,
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
              { id: 'edit', title: t.actions.edit },
              {
                id: 'delete',
                title: t.actions.delete,
                attributes: { destructive: true },
              },
            ]}
            onAction={(action) =>
              action === 'edit'
                ? setEditing(item._id)
                : ConfirmDelete(t.actions, {
                    title: fmt(t.kitchen.deleteTitle, { title: item.title }),
                    body: t.kitchen.deleteBody,
                    onDelete: () =>
                      remove({ groupSlug: group.slug, id: item._id }),
                  })
            }
          >
            <SwipeableRow
              deleteLabel={t.actions.delete}
              onDelete={() =>
                ConfirmDelete(t.actions, {
                  title: fmt(t.kitchen.deleteTitle, { title: item.title }),
                  body: t.kitchen.deleteBody,
                  onDelete: () =>
                    remove({ groupSlug: group.slug, id: item._id }),
                })
              }
            >
              <Pressable
                onPress={() => setEditing(item._id)}
                style={[
                  styles.row,
                  {
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Text style={[styles.title, { color: tokens.fg }]}>
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
          style={[styles.input, { color: tokens.fg }]}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={[styles.input, { color: tokens.fg }]}
        />
        <Pressable onPress={() => onSave(title, quantity)}>
          <Text style={{ color: tokens.accent }}>{t.actions.save}</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>{t.actions.cancel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    padding: 10,
    gap: 8,
  },
  input: {
    minHeight: 40,
    fontSize: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000022',
  },
  add: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
    paddingHorizontal: 10,
  },
  row: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navButton: { padding: 8 },
  weekTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center', flex: 1 },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.control,
  },
  clear: { padding: 6 },
  dayMain: { flex: 1, gap: 2, paddingVertical: 10 },
  dayName: { fontSize: 13, fontWeight: '600' },
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
  section: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: {
    padding: 20,
    gap: 12,
    borderTopLeftRadius: RADIUS.control,
    borderTopRightRadius: RADIUS.control,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
  },
})
