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
import { SwipeableRow } from '../../components/SwipeableRow'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
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
const timeToMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes < 24 * 60 && Number(match[2]) < 60 ? minutes : undefined
}
const minutesToTime = (value?: number) =>
  value === undefined
    ? ''
    : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

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

export function MealPlannerScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
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
  return (
    <KitchenShell title={t.modules.byId['meal-planner'].label}>
      <View style={styles.nav}>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <Text style={{ color: tokens.accent }}>{t.kitchen.previousWeek}</Text>
        </Pressable>
        <Text style={[styles.title, { color: tokens.fg }]}>{from}</Text>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, 7))}>
          <Text style={{ color: tokens.accent }}>{t.kitchen.nextWeek}</Text>
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
            <Pressable style={{ flex: 1 }} onPress={() => setPickerDate(date)}>
              <Text style={[styles.title, { color: tokens.fg }]}>
                {new Date(`${date}T12:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
              <Text style={{ color: tokens.muted }}>
                {dinner?.title ?? t.kitchen.noMeals}
              </Text>
            </Pressable>
            <View style={styles.inline}>
              {([10, 20, 30] as const).map((limit) => (
                <Pressable
                  key={limit}
                  onPress={() => {
                    if (!dinner) {
                      setPickerLimit(limit)
                      setPickerDate(date)
                      return
                    }
                    return setDinner({
                      groupSlug: group.slug,
                      date,
                      title: dinner?.title ?? '',
                      prepMinutes: dinner?.prepMinutes,
                      recipeId: dinner?.recipeId,
                      mealEntryId: dinner?.mealEntryId,
                      quickLimit:
                        dinner.quickLimit === limit ? undefined : limit,
                    })
                  }}
                >
                  <Text
                    style={{
                      color:
                        dinner?.quickLimit === limit
                          ? tokens.accent
                          : tokens.muted,
                    }}
                  >
                    {limit}
                  </Text>
                </Pressable>
              ))}
              {dinner ? (
                <Pressable
                  onPress={() => clearDinner({ groupSlug: group.slug, date })}
                >
                  <Text style={{ color: tokens.muted }}>×</Text>
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
      <Modal
        visible={pickerDate !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPickerDate(null)
          setPickerLimit(undefined)
        }}
      >
        <View style={styles.modal}>
          <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
            <Text style={[styles.section, { color: tokens.fg }]}>
              {t.kitchen.chooseDinner}
            </Text>
            {pickerCandidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                onPress={() => {
                  if (pickerDate)
                    choose(
                      pickerDate,
                      candidate,
                      pickerLimit ?? pickerDinner?.quickLimit,
                    )
                  setPickerDate(null)
                  setPickerLimit(undefined)
                  haptics.selectionChanged()
                }}
                style={styles.row}
              >
                <Text style={[styles.title, { color: tokens.fg }]}>
                  {candidate.title}
                </Text>
                <Text style={{ color: tokens.muted }}>
                  {candidate.prepMinutes}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setPickerDate(null)
                setPickerLimit(undefined)
              }}
            >
              <Text style={{ color: tokens.accent }}>{t.actions.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
        headerLeft={() => (
          <Pressable
            onPress={() => set({ groupSlug: group.slug, listId: null })}
          >
            <Text>{t.kitchen.changeList}</Text>
          </Pressable>
        )}
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

export function CalendarScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('home')
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [date, setDate] = useState(iso(new Date()))
  const [event, setEvent] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [calendarId, setCalendarId] = useState<Id<'calendars'> | null>(null)
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = monday(first)
  const data = useQuery(api.kitchen.overview, {
    groupSlug: group.slug,
    from: iso(gridStart),
    to: iso(addDays(gridStart, 41)),
  })
  const addCalendar = useMutation(api.kitchen.addCalendar)
  const addEvent = useMutation(api.kitchen.addCalendarEvent)
  const removeCalendar = useMutation(api.kitchen.removeCalendar)
  const removeEvent = useMutation(api.kitchen.removeCalendarEvent)
  const visibility = useMutation(api.kitchen.setCalendarVisibility)
  const selectedCalendar = calendarId ?? data?.calendars[0]?._id
  const selectedEvents =
    data?.events.filter(
      (row) =>
        row.date === date && !data.hiddenCalendarIds.includes(row.calendarId),
    ) ?? []
  return (
    <KitchenShell title={t.modules.byId.calendar.label}>
      <View style={styles.nav}>
        <Pressable
          accessibilityLabel={t.kitchen.previousMonth}
          onPress={() => {
            const next = new Date(month.getFullYear(), month.getMonth() - 1, 1)
            setMonth(next)
            setDate(iso(next))
          }}
        >
          <Text style={{ color: tokens.accent }}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: tokens.fg }]}>
          {month.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          accessibilityLabel={t.kitchen.nextMonth}
          onPress={() => {
            const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
            setMonth(next)
            setDate(iso(next))
          }}
        >
          <Text style={{ color: tokens.accent }}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 42 }, (_, index) => {
          const day = addDays(gridStart, index)
          const value = iso(day)
          const active = value === date
          const hasEvents = data?.events.some(
            (row) =>
              row.date === value &&
              !data.hiddenCalendarIds.includes(row.calendarId),
          )
          return (
            <Pressable
              key={value}
              onPress={() => setDate(value)}
              style={[styles.day, active && { backgroundColor: tokens.accent }]}
            >
              <Text
                style={{
                  color: active
                    ? tokens.onAccent
                    : day.getMonth() === month.getMonth()
                      ? tokens.fg
                      : tokens.muted,
                }}
              >
                {day.getDate()}
                {hasEvents ? ' •' : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Composer
        labels={{ name: t.kitchen.newCalendar, add: t.kitchen.add }}
        onSave={(name) => addCalendar({ groupSlug: group.slug, name })}
      />
      {data?.calendars.map((calendar) => {
        const shown = !data.hiddenCalendarIds.includes(calendar._id)
        return (
          <NativeContextMenu
            key={calendar._id}
            actions={[
              {
                id: 'delete',
                title: t.actions.delete,
                attributes: { destructive: true },
              },
            ]}
            onAction={() =>
              ConfirmDelete(t.actions, {
                title: fmt(t.kitchen.deleteTitle, { title: calendar.name }),
                body: t.kitchen.deleteBody,
                onDelete: () =>
                  removeCalendar({ groupSlug: group.slug, id: calendar._id }),
              })
            }
          >
            <SwipeableRow
              deleteLabel={t.actions.delete}
              onDelete={() =>
                ConfirmDelete(t.actions, {
                  title: fmt(t.kitchen.deleteTitle, { title: calendar.name }),
                  body: t.kitchen.deleteBody,
                  onDelete: () =>
                    removeCalendar({ groupSlug: group.slug, id: calendar._id }),
                })
              }
            >
              <Pressable
                onPress={() => setCalendarId(calendar._id)}
                style={[
                  styles.row,
                  {
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Pressable
                  accessibilityLabel={
                    shown ? t.kitchen.hidden : t.kitchen.visible
                  }
                  onPress={() =>
                    visibility({
                      groupSlug: group.slug,
                      calendarId: calendar._id,
                      visible: !shown,
                    })
                  }
                >
                  <Text style={{ color: tokens.accent }}>
                    {shown ? '☑' : '☐'}
                  </Text>
                </Pressable>
                <Text style={[styles.title, { color: tokens.fg }]}>
                  {calendar.name}
                </Text>
                {selectedCalendar === calendar._id ? (
                  <Text style={{ color: tokens.muted }}>•</Text>
                ) : null}
              </Pressable>
            </SwipeableRow>
          </NativeContextMenu>
        )
      })}
      {selectedCalendar ? (
        <View
          style={[
            styles.composer,
            { borderColor: tokens.border, backgroundColor: tokens.surface },
          ]}
        >
          <TextInput
            value={event}
            onChangeText={setEvent}
            placeholder={t.kitchen.newEvent}
            style={[styles.input, { color: tokens.fg }]}
          />
          <TextInput
            value={start}
            onChangeText={setStart}
            placeholder={t.kitchen.startTime}
            style={[styles.input, { color: tokens.fg }]}
          />
          <TextInput
            value={end}
            onChangeText={setEnd}
            placeholder={t.kitchen.endTime}
            style={[styles.input, { color: tokens.fg }]}
          />
          <Pressable
            onPress={() => {
              const startMinutes = timeToMinutes(start)
              const endMinutes = timeToMinutes(end)
              if (
                !event.trim() ||
                Boolean(start) !== Boolean(end) ||
                (start &&
                  (startMinutes === undefined || endMinutes === undefined))
              )
                return haptics.actionFailed()
              addEvent({
                groupSlug: group.slug,
                calendarId: selectedCalendar,
                title: event,
                date,
                startMinutes,
                endMinutes,
              }).then(() => {
                setEvent('')
                setStart('')
                setEnd('')
                haptics.itemSaved()
              })
            }}
            style={[styles.add, { backgroundColor: tokens.accent }]}
          >
            <Text style={{ color: tokens.onAccent }}>{t.kitchen.add}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: tokens.muted }}>{t.kitchen.noCalendars}</Text>
      )}
      <Text style={[styles.section, { color: tokens.fg }]}>{date}</Text>
      {selectedEvents.length === 0 ? (
        <Text style={{ color: tokens.muted }}>{t.kitchen.noEvents}</Text>
      ) : (
        selectedEvents.map((row) => (
          <NativeContextMenu
            key={row._id}
            actions={[
              {
                id: 'delete',
                title: t.actions.delete,
                attributes: { destructive: true },
              },
            ]}
            onAction={() =>
              ConfirmDelete(t.actions, {
                title: fmt(t.kitchen.deleteTitle, { title: row.title }),
                body: t.kitchen.deleteBody,
                onDelete: () =>
                  removeEvent({ groupSlug: group.slug, id: row._id }),
              })
            }
          >
            <SwipeableRow
              deleteLabel={t.actions.delete}
              onDelete={() =>
                ConfirmDelete(t.actions, {
                  title: fmt(t.kitchen.deleteTitle, { title: row.title }),
                  body: t.kitchen.deleteBody,
                  onDelete: () =>
                    removeEvent({ groupSlug: group.slug, id: row._id }),
                })
              }
            >
              <View
                style={[
                  styles.row,
                  {
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Text style={[styles.title, { color: tokens.fg }]}>
                  {row.title}
                </Text>
                <Text style={{ color: tokens.muted }}>
                  {row.startMinutes === undefined
                    ? ''
                    : `${minutesToTime(row.startMinutes)}–${minutesToTime(row.endMinutes)}`}
                </Text>
              </View>
            </SwipeableRow>
          </NativeContextMenu>
        ))
      )}
    </KitchenShell>
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
  inline: { flexDirection: 'row', gap: 8 },
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
