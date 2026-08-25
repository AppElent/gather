import {
  eligibleDinnerCandidates,
  randomDinner,
} from '@gather/core/meal-planner'
import { useMutation, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Alert,
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
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { useTaskState } from '../tasks/store'
import { TaskList } from '../tasks/TaskListScreen'

const iso = (date: Date) => date.toISOString().slice(0, 10)
const monday = (date: Date) => {
  const copy = new Date(date)
  const offset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - offset)
  return copy
}
const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

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
}: {
  labels: { name: string; extra?: string; add: string }
  onSave: (name: string, extra?: string) => Promise<unknown>
}) {
  const tokens = useTokens('kitchen')
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('')
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
      <TextInput
        value={extra}
        onChangeText={setExtra}
        placeholder={labels.extra}
        placeholderTextColor={tokens.muted}
        style={[styles.input, { color: tokens.fg }]}
      />
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

export function MealPlannerScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('kitchen')
  const from = iso(monday(new Date()))
  const to = iso(addDays(monday(new Date()), 6))
  const data = useQuery(api.kitchen.overview, {
    groupSlug: group.slug,
    from,
    to,
  })
  const addMeal = useMutation(api.kitchen.addMealEntry)
  const setDinner = useMutation(api.kitchen.setDinner)
  const clearDinner = useMutation(api.kitchen.clearDinner)
  const candidates = useMemo(
    () => [
      ...(data?.mealEntries ?? []).map((entry) => ({
        id: entry._id,
        title: entry.title,
        prepMinutes: entry.prepMinutes,
      })),
      ...(data?.recipes ?? []).map((recipe) => ({
        id: recipe._id,
        title: recipe.title,
        prepMinutes: recipe.prepMinutes,
      })),
    ],
    [data],
  )
  return (
    <KitchenShell title={t.modules.byId['meal-planner'].label}>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.prepMinutes,
          add: t.kitchen.add,
        }}
        onSave={(name, prep) =>
          addMeal({
            groupSlug: group.slug,
            title: name,
            prepMinutes: Number(prep) || undefined,
          })
        }
      />
      {Array.from({ length: 7 }, (_, index) => {
        const date = iso(addDays(monday(new Date()), index))
        const dinner = data?.dinners.find((row) => row.date === date)
        const limit = dinner?.quickLimit
        const choose = () => {
          const candidate = randomDinner(
            eligibleDinnerCandidates(candidates, limit),
            dinner?.recipeId ?? dinner?.mealEntryId,
          )
          if (!candidate) return
          const recipe = data?.recipes.find((row) => row._id === candidate.id)
          return setDinner({
            groupSlug: group.slug,
            date,
            title: candidate.title,
            prepMinutes: candidate.prepMinutes,
            recipeId: recipe?._id,
            mealEntryId: recipe
              ? undefined
              : (candidate.id as Id<'mealEntries'>),
            quickLimit: limit,
          }).then(() => haptics.itemSaved())
        }
        return (
          <View
            key={date}
            style={[
              styles.row,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
            ]}
          >
            <View style={{ flex: 1 }}>
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
            </View>
            <Pressable onPress={() => choose()} hitSlop={10}>
              <UI_ICONS.Check size={20} color={tokens.accent} />
            </Pressable>
            {dinner ? (
              <Pressable
                onPress={() => clearDinner({ groupSlug: group.slug, date })}
              >
                <UI_ICONS.X size={20} color={tokens.muted} />
              </Pressable>
            ) : null}
          </View>
        )
      })}
    </KitchenShell>
  )
}

export function GroceriesScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const data = useQuery(api.kitchen.overview, { groupSlug: group.slug })
  const set = useMutation(api.kitchen.setGroceryList)
  const state = useTaskState()
  const selected = data?.groceryListId
  if (selected) return <TaskList listId={selected} />
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
  const remove = useMutation(api.kitchen.removePantryEntry)
  const confirm = (id: Id<'pantryEntries'>, title: string) =>
    Alert.alert(fmt(t.kitchen.deleteTitle, { title }), t.kitchen.deleteBody, [
      { text: t.actions.cancel, style: 'cancel' },
      {
        text: t.actions.delete,
        style: 'destructive',
        onPress: () => remove({ groupSlug: group.slug, id }),
      },
    ])
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
        data?.pantry.map((entry) => (
          <SwipeableRow
            key={entry._id}
            deleteLabel={t.actions.delete}
            onDelete={() => confirm(entry._id, entry.title)}
          >
            <NativeContextMenu
              actions={[
                {
                  id: 'delete',
                  title: t.actions.delete,
                  attributes: { destructive: true },
                },
              ]}
              onAction={() => confirm(entry._id, entry.title)}
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
                  {entry.title}
                </Text>
                <Text style={{ color: tokens.muted }}>{entry.quantity}</Text>
              </View>
            </NativeContextMenu>
          </SwipeableRow>
        ))
      )}
    </KitchenShell>
  )
}

export function CalendarScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('home')
  const data = useQuery(api.kitchen.overview, { groupSlug: group.slug })
  const addCalendar = useMutation(api.kitchen.addCalendar)
  const addEvent = useMutation(api.kitchen.addCalendarEvent)
  const visibility = useMutation(api.kitchen.setCalendarVisibility)
  const [date, setDate] = useState(iso(new Date()))
  const [event, setEvent] = useState('')
  const first = data?.calendars[0]
  return (
    <KitchenShell title={t.modules.byId.calendar.label}>
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
                id: 'visibility',
                title: shown ? t.kitchen.hidden : t.kitchen.visible,
              },
            ]}
            onAction={() =>
              visibility({
                groupSlug: group.slug,
                calendarId: calendar._id,
                visible: !shown,
              }).then(() => haptics.selectionChanged())
            }
          >
            <View
              style={[
                styles.row,
                { borderColor: tokens.border, backgroundColor: tokens.surface },
              ]}
            >
              <Text style={[styles.title, { color: tokens.fg }]}>
                {calendar.name}
              </Text>
              <Text style={{ color: tokens.muted }}>{shown ? '✓' : ''}</Text>
            </View>
          </NativeContextMenu>
        )
      })}
      {first ? (
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
            value={date}
            onChangeText={setDate}
            placeholder={t.kitchen.eventDate}
            style={[styles.input, { color: tokens.fg }]}
          />
          <Pressable
            onPress={() =>
              event.trim() &&
              addEvent({
                groupSlug: group.slug,
                calendarId: first._id,
                title: event,
                date,
              }).then(() => {
                setEvent('')
                haptics.itemSaved()
              })
            }
            style={[styles.add, { backgroundColor: tokens.accent }]}
          >
            <Text style={{ color: tokens.onAccent }}>{t.kitchen.add}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: tokens.muted }}>{t.kitchen.noCalendars}</Text>
      )}
      {data?.events
        .filter((row) => !data.hiddenCalendarIds.includes(row.calendarId))
        .map((row) => (
          <View
            key={row._id}
            style={[
              styles.row,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
            ]}
          >
            <Text style={[styles.title, { color: tokens.fg }]}>
              {row.title}
            </Text>
            <Text style={{ color: tokens.muted }}>{row.date}</Text>
          </View>
        ))}
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
})
