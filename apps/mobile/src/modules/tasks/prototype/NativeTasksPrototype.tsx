// THROWAWAY — native exploration of accepted functional direction A.
// Menus, sheets and gestures are real; all records and writes are in memory.
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import type { MenuAction } from '@expo/ui/community/menu'
import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import { NativeContextMenu } from '../../../components/NativeContextMenu'
import { NativeSheet } from '../../../components/NativeSheet'
import { haptics } from '../../../feedback/haptics'
import { useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { useTokens } from '../../../theme/tokens'
import { TASK_ICONS } from '../icons'
import { PrototypeComposer } from './PrototypeComposer'
import { PrototypeFeed } from './PrototypeFeed'
import { PrototypeNativeRow } from './PrototypeNativeRow'
import {
  blank,
  clone,
  completeSample,
  patchSample,
  plusDays,
  resetSample,
  type SampleTask,
  sampleLists,
  sampleNow,
  useSample,
  writable,
} from './state'

export function NativeTasksPrototype() {
  const { list } = useLocalSearchParams<{ list?: string }>()
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const m = t.tasksPrototype
  const state = useSample()
  const [mine, setMine] = useState(false)
  const [sheet, setSheet] = useState<
    'editor' | 'lists' | 'controls' | 'history' | 'state' | null
  >(null)
  const [expanded, setExpanded] = useState(false)
  const [dateTarget, setDateTarget] = useState<number | 'parent' | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [display, setDisplay] = useState({
    due: true,
    labels: true,
    priority: true,
  })
  const draft = state.draft
  const listName = (id: string) => m[id as (typeof sampleLists)[number]] ?? id
  const whoName = (who: string) => (who === 'Eric' ? m.me : who || m.unassigned)
  const day = (date: string) =>
    date === state.today
      ? m.today
      : new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
        })
  const setDraft = (patch: Partial<SampleTask>) =>
    patchSample({ draft: state.draft ? { ...state.draft, ...patch } : null })
  const closeSheet = () => {
    const discardAndClose = () => {
      if (sheet === 'editor') patchSample({ draft: null })
      setSheet(null)
      setDateTarget(null)
      setNotice('')
      Keyboard.dismiss()
    }
    if (sheet === 'editor' && sampleNow().draft) {
      const d = sampleNow().draft!
      const original =
        d.id === 'new'
          ? blank('new', '', d.list)
          : sampleNow().tasks.find((task) => task.id === d.id)
      if (JSON.stringify(d) !== JSON.stringify(original)) {
        Alert.alert(m.discardQuestion, m.discardHint, [
          { text: m.keepEditing, style: 'cancel' },
          { text: m.discard, style: 'destructive', onPress: discardAndClose },
        ])
        return
      }
    }
    discardAndClose()
  }
  const openEditor = (task?: SampleTask, details = false) => {
    const existing = sampleNow().draft
    if (existing && existing.id !== (task?.id ?? 'new')) {
      Alert.alert(m.draft, m.draftExists, [
        { text: m.cancel, style: 'cancel' },
        {
          text: m.draft,
          onPress: () => {
            setExpanded(true)
            setSheet('editor')
          },
        },
        {
          text: m.discard,
          style: 'destructive',
          onPress: () => {
            patchSample({
              draft: task ? clone(task) : blank('new', '', list ?? 'household'),
            })
            setExpanded(details)
            setSheet('editor')
          },
        },
      ])
      return
    }
    if (!existing)
      patchSample({
        draft: task ? clone(task) : blank('new', '', list ?? 'household'),
      })
    setExpanded(details)
    setDateTarget(null)
    setSheet('editor')
  }
  const providerAck = async (listId: string) => {
    if (!writable(listId)) return false
    if (listId === 'weekend') {
      setBusy(true)
      setNotice(m.pending)
      await new Promise((resolve) => setTimeout(resolve, 550))
      setBusy(false)
    }
    return writable(listId)
  }
  const save = async () => {
    const d = sampleNow().draft
    if (!d || busy || !writable(d.list)) return
    if (!d.title.trim() || d.children.some((c) => !c.title.trim())) {
      Alert.alert(m.required)
      return
    }
    const original = sampleNow().tasks.find((task) => task.id === d.id)
    if (original && original.revision !== d.revision) {
      Alert.alert(m.draftConflict, undefined, [
        { text: m.cancel, style: 'cancel' },
        {
          text: m.current,
          onPress: () => patchSample({ draft: clone(original) }),
        },
      ])
      return
    }
    if (!(await providerAck(d.list))) {
      setNotice(m.outage)
      return
    }
    const saved = {
      ...clone(d),
      id: d.id === 'new' ? `task-${Date.now()}` : d.id,
      title: d.title.trim(),
      revision: d.revision + 1,
    }
    patchSample({
      tasks: original
        ? sampleNow().tasks.map((task) => (task.id === d.id ? saved : task))
        : [...sampleNow().tasks, saved],
      draft: null,
    })
    haptics.itemSaved()
    setSheet(null)
    setNotice(d.list === 'weekend' ? m.simulated : m.saved)
  }
  const finish = async (task: SampleTask, children: boolean) => {
    if (!(await providerAck(task.list))) return
    completeSample(task.id, children)
    haptics.itemCompleted()
    const next = sampleNow().tasks.find((x) => x.id === task.id)!
    setNotice(
      next.repeat
        ? `${m.next}: ${day(next.due)}`
        : task.done
          ? m.undo
          : m.complete,
    )
  }
  const toggle = (task: SampleTask) => {
    if (!writable(task.list) || busy) return
    if (task.repeat && task.due > state.today) {
      Alert.alert(m.early)
      return
    }
    if (!task.done && task.children.some((c) => !c.done)) {
      Alert.alert(m.parentQuestion, task.title, [
        { text: m.cancel, style: 'cancel' },
        { text: m.parentOnly, onPress: () => void finish(task, false) },
        { text: m.completeAll, onPress: () => void finish(task, true) },
      ])
      return
    }
    void finish(task, false)
  }
  const remove = (task: SampleTask) => {
    if (!writable(task.list) || busy) return
    Alert.alert(m.deleteQuestion, task.title, [
      { text: m.cancel, style: 'cancel' },
      {
        text: m.delete,
        style: 'destructive',
        onPress: async () => {
          if (!(await providerAck(task.list))) return
          patchSample({
            tasks: sampleNow().tasks.filter((t) => t.id !== task.id),
            draft: sampleNow().draft?.id === task.id ? null : sampleNow().draft,
          })
          setNotice(m.delete)
        },
      },
    ])
  }
  const rowActions = (task: SampleTask): MenuAction[] => [
    {
      id: 'complete',
      title: task.done ? m.undo : m.complete,
      image: 'checkmark.circle',
      attributes: { disabled: !writable(task.list) || busy },
    },
    {
      id: 'edit',
      title: m.edit,
      image: 'pencil',
      attributes: { disabled: !writable(task.list) || busy },
    },
    {
      id: 'due',
      title: m.due,
      image: 'calendar',
      attributes: { disabled: !writable(task.list) || busy },
    },
    {
      id: 'delete',
      title: m.delete,
      image: 'trash',
      attributes: { destructive: true, disabled: !writable(task.list) || busy },
    },
  ]
  const menuAction = (task: SampleTask, action: string) => {
    if (action === 'complete') toggle(task)
    else if (action === 'delete') remove(task)
    else {
      openEditor(task, true)
      if (action === 'due') {
        Keyboard.dismiss()
        setDateTarget('parent')
      }
    }
  }
  const menu: MenuAction[] = [
    {
      id: 'completed',
      title: m.showCompleted,
      state: showCompleted ? 'on' : 'off',
      image: 'checkmark.circle',
    },
    { id: 'history', title: m.history, image: 'clock' },
    ...(['due', 'priority', 'labels'] as const).map((key) => ({
      id: `display-${key}`,
      title:
        key === 'due'
          ? m.rowDates
          : key === 'priority'
            ? m.rowPriority
            : m.rowLabels,
      state: display[key] ? ('on' as const) : ('off' as const),
    })),
    { id: 'controls', title: m.controls, image: 'slider.horizontal.3' },
  ]
  const headerAction = (id: string) => {
    if (id === 'completed') setShowCompleted(!showCompleted)
    else if (id === 'history' || id === 'controls') setSheet(id)
    else if (id.startsWith('display-')) {
      const key = id.slice(8) as keyof typeof display
      setDisplay({ ...display, [key]: !display[key] })
    }
  }
  const rows = (items: SampleTask[]) =>
    items.length ? (
      items.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          meta={[
            task.children.length
              ? `${task.children.filter((c) => c.done).length}/${task.children.length}`
              : '',
            display.due && task.due
              ? `${day(task.due)}${task.repeat ? ' ↻' : ''}`
              : '',
            display.priority && task.high ? m.high : '',
            display.labels ? task.labels : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          source={list ? '' : listName(task.list)}
          overdue={!!task.due && task.due < state.today && !task.done}
          disabled={!writable(task.list) || busy}
          actions={rowActions(task)}
          onMenu={(action) => menuAction(task, action)}
          onOpen={() => openEditor(task)}
          onToggle={() => toggle(task)}
          onDelete={() => remove(task)}
        />
      ))
    ) : (
      <Text style={[styles.empty, { color: tokens.muted }]}>{m.noTasks}</Text>
    )
  const filtered = state.tasks.filter(
    (task) =>
      (showCompleted || !task.done) &&
      (list
        ? task.list === list
        : !mine || task.who === 'Eric' || (state.mineUnassigned && !task.who)),
  )
  const title = list ? listName(list) : t.labs.tasks.title
  const actionButton = (
    text: string,
    onPress: () => void,
    id?: string,
    disabled = false,
  ) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={text}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color: tokens.accent, fontSize: 17, fontWeight: '600' }}>
        {text}
      </Text>
    </Pressable>
  )
  const fieldMenu = (
    label: string,
    value: string,
    choices: [string, string][],
    pick: (id: string) => void,
    disabled = false,
  ) => (
    <NativeContextMenu
      trigger="press"
      style={{ opacity: disabled ? 0.45 : 1 }}
      actions={choices.map(([id, title]) => ({
        id,
        title,
        attributes: { disabled },
      }))}
      onAction={pick}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={[styles.field, { borderColor: tokens.border }]}
      >
        <Text style={[styles.fieldLabel, { color: tokens.fg }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: tokens.muted }]}>
          {value}
        </Text>
        <UI_ICONS.ChevronRight size={16} color={tokens.muted} />
      </View>
    </NativeContextMenu>
  )
  const listRows = () =>
    sampleLists.map((id) => (
      <Pressable
        testID={`prototype-list-${id}`}
        key={id}
        onPress={() => {
          setSheet(null)
          router.push({
            pathname: '/all/tasks-prototype',
            params: { list: id },
          })
        }}
        style={[styles.field, { borderColor: tokens.border }]}
        accessibilityRole="button"
      >
        <UI_ICONS.List size={21} color={tokens.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, color: tokens.fg }}>{listName(id)}</Text>
          {id === 'weekend' || id === 'moving' ? (
            <Text style={{ fontSize: 12, color: tokens.muted }}>
              {id === 'weekend' ? 'Todoist' : 'Notion'}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: tokens.muted }}>
          {state.tasks.filter((task) => task.list === id && !task.done).length}
        </Text>
        <UI_ICONS.ChevronRight size={16} color={tokens.muted} />
      </Pressable>
    ))
  const readOnly = draft ? !writable(draft.list) : false
  const limited = draft?.list === 'weekend'
  const updateChild = (index: number, patch: Partial<SampleTask>) => {
    if (draft)
      setDraft({
        children: draft.children.map((child, i) =>
          i === index ? { ...child, ...patch } : child,
        ),
      })
  }
  const selectedDate =
    dateTarget === 'parent'
      ? draft?.due
      : typeof dateTarget === 'number'
        ? draft?.children[dateTarget]?.due
        : undefined
  const chooseDate = (value: string) => {
    if (dateTarget === 'parent')
      setDraft({
        due: value,
        ...(!value ? { repeat: '', reminder: false } : {}),
      })
    else if (typeof dateTarget === 'number')
      updateChild(dateTarget, { due: value })
    if (Platform.OS === 'android') setDateTarget(null)
  }
  const switchRow = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    id: string,
  ) => (
    <View style={[styles.field, { borderColor: tokens.border }]}>
      <Text style={[styles.fieldLabel, { color: tokens.fg }]}>{label}</Text>
      <Switch
        testID={id}
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  )

  const introduction = (
    <>
      <Text
        testID="tasks-prototype-marker"
        style={[styles.badge, { color: tokens.muted }]}
      >
        {m.badge}
      </Text>
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            {
              color: tokens.accent,
              backgroundColor: tokens.tintOf('home').bg,
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}
      {state.draft
        ? actionButton(
            m.draft,
            () => {
              setSheet('editor')
              setExpanded(false)
            },
            'prototype-resume',
          )
        : null}
      {!list ? (
        <SegmentedControl
          testID="prototype-filter"
          values={[m.everyone, m.mine]}
          selectedIndex={mine ? 1 : 0}
          appearance={tokens.scheme}
          onChange={(event) => {
            setMine(event.nativeEvent.selectedSegmentIndex === 1)
            haptics.selectionChanged()
          }}
          style={{ marginVertical: 14 }}
        />
      ) : null}
      {list && !writable(list) ? (
        <Text style={[styles.notice, { color: tokens.danger }]}>
          {list === 'moving' ? m.readOnly : m.outage}
        </Text>
      ) : null}
    </>
  )
  const footer = (
    <>
      {actionButton(
        `+ ${m.add}`,
        () => openEditor(),
        'prototype-add',
        !!list && !writable(list),
      )}
      {!list ? (
        <>
          <Text style={[styles.heading, { color: tokens.fg }]}>{m.lists}</Text>
          {listRows()}
        </>
      ) : null}
    </>
  )
  return (
    <>
      <PrototypeFeed
        header={introduction}
        footer={footer}
        empty={m.noTasks}
        sections={
          list
            ? [{ title: '', tasks: filtered }]
            : [
                {
                  title: m.overdue,
                  tasks: filtered.filter(
                    (task) => task.due && task.due < state.today,
                  ),
                },
                {
                  title: m.today,
                  tasks: filtered.filter((task) => task.due === state.today),
                },
              ]
        }
        renderRow={(task) => rows([task])}
      />
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLargeTitle: false,
          headerTitleStyle: { color: tokens.fg },
          headerTintColor: tokens.accent,
          headerStyle: { backgroundColor: tokens.bg },
          headerRight:
            Platform.OS === 'ios'
              ? undefined
              : () => (
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <Pressable
                      testID="prototype-lists"
                      onPress={() => setSheet('lists')}
                      accessibilityLabel={m.lists}
                    >
                      <UI_ICONS.List size={24} color={tokens.accent} />
                    </Pressable>
                    <NativeContextMenu
                      trigger="press"
                      actions={menu}
                      onAction={headerAction}
                    >
                      <View
                        testID="prototype-overflow"
                        accessible
                        accessibilityLabel={m.more}
                        style={{ padding: 8 }}
                      >
                        <UI_ICONS.Ellipsis size={24} color={tokens.accent} />
                      </View>
                    </NativeContextMenu>
                  </View>
                ),
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="list.bullet"
            onPress={() => setSheet('lists')}
          >
            {m.lists}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Menu icon="ellipsis" title={m.more}>
            {menu.map((item) => (
              <Stack.Toolbar.MenuAction
                key={item.id}
                isOn={item.state === 'on'}
                onPress={() => headerAction(item.id!)}
              >
                {item.title}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}

      {sheet === 'lists' ? (
        <NativeSheet title={m.lists} onClose={closeSheet}>
          {listRows()}
        </NativeSheet>
      ) : null}
      {sheet === 'editor' && draft ? (
        <PrototypeComposer
          title={draft.id === 'new' ? m.add : m.edit}
          onClose={closeSheet}
          expanded={expanded}
          onSave={() => void save()}
          disabled={readOnly || busy}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <TextInput
              testID="prototype-title"
              accessibilityLabel={m.title}
              placeholder={m.title}
              placeholderTextColor={tokens.muted}
              value={draft.title}
              editable={!readOnly && !busy}
              onChangeText={(title) => setDraft({ title })}
              autoFocus={!readOnly}
              multiline
              style={[styles.titleInput, { color: tokens.fg }]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
            >
              <NativeContextMenu
                trigger="press"
                actions={sampleLists
                  .filter((id) => id !== 'moving')
                  .map((id) => ({
                    id,
                    title: listName(id),
                    attributes: {
                      disabled: readOnly || draft.id !== 'new' || busy,
                    },
                  }))}
                onAction={(id) => {
                  if (
                    id === 'weekend' &&
                    (draft.who ||
                      draft.repeat ||
                      draft.children.length ||
                      draft.reminder)
                  ) {
                    Alert.alert(m.limited)
                    return
                  }
                  setDraft({ list: id })
                }}
              >
                <View style={[styles.chip, { borderColor: tokens.border }]}>
                  <UI_ICONS.List size={18} color={tokens.muted} />
                  <Text style={{ color: tokens.fg }}>
                    {listName(draft.list)}
                  </Text>
                </View>
              </NativeContextMenu>
              <Pressable
                testID="prototype-date-chip"
                disabled={readOnly || busy}
                onPress={() => {
                  setExpanded(true)
                  Keyboard.dismiss()
                  setDateTarget('parent')
                }}
                style={[styles.chip, { borderColor: tokens.border }]}
              >
                <TASK_ICONS.Calendar size={18} color={tokens.accent} />
                <Text style={{ color: tokens.accent }}>
                  {draft.due ? day(draft.due) : m.due}
                </Text>
              </Pressable>
              <NativeContextMenu
                trigger="press"
                actions={[
                  {
                    id: 'normal',
                    title: m.normal,
                    attributes: { disabled: readOnly || busy },
                  },
                  {
                    id: 'high',
                    title: m.high,
                    attributes: { disabled: readOnly || busy },
                  },
                ]}
                onAction={(id) => setDraft({ high: id === 'high' })}
              >
                <View style={[styles.chip, { borderColor: tokens.border }]}>
                  <TASK_ICONS.Flag size={18} color={tokens.muted} />
                  <Text style={{ color: tokens.fg }}>
                    {draft.high ? m.high : m.normal}
                  </Text>
                </View>
              </NativeContextMenu>
            </ScrollView>
            {readOnly ? (
              <Text style={[styles.notice, { color: tokens.danger }]}>
                {draft.list === 'moving' ? m.readOnly : m.outage}
              </Text>
            ) : null}
            {limited ? (
              <Text style={[styles.hint, { color: tokens.muted }]}>
                {m.limited}
              </Text>
            ) : null}
            {actionButton(
              expanded ? m.less : m.more,
              () => setExpanded(!expanded),
              'prototype-expand',
            )}
            {expanded ? (
              <>
                {actionButton(
                  `${m.due}: ${draft.due ? day(draft.due) : m.none}`,
                  () => {
                    Keyboard.dismiss()
                    setDateTarget('parent')
                  },
                  'prototype-due',
                  readOnly || busy,
                )}
                {dateTarget !== null && !readOnly ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: tokens.fg }}>{m.chooseDate}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {actionButton(
                        m.today,
                        () => chooseDate(state.today),
                        'prototype-date-today',
                      )}
                      {actionButton(m.tomorrow, () =>
                        chooseDate(plusDays(state.today, 1)),
                      )}
                      {actionButton(m.clear, () => chooseDate(''))}
                    </View>
                    <DateTimePicker
                      testID="prototype-date-picker"
                      value={
                        new Date(`${selectedDate || state.today}T12:00:00`)
                      }
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      locale={locale}
                      themeVariant={tokens.scheme}
                      accentColor={tokens.accent}
                      onValueChange={(_event, date) =>
                        chooseDate(
                          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                        )
                      }
                      onDismiss={() => setDateTarget(null)}
                    />
                    {Platform.OS === 'ios'
                      ? actionButton(m.done, () => setDateTarget(null))
                      : null}
                  </View>
                ) : null}
                {fieldMenu(
                  m.who,
                  whoName(draft.who),
                  [
                    ['', m.unassigned],
                    ['Eric', m.me],
                    ['Anne', 'Anne'],
                  ],
                  (who) => setDraft({ who }),
                  readOnly || limited || busy,
                )}
                {fieldMenu(
                  m.repeat,
                  draft.repeat
                    ? m[draft.repeat as 'fixed' | 'interval' | 'monthly']
                    : m.none,
                  [
                    ['', m.none],
                    ['fixed', m.fixed],
                    ['interval', m.interval],
                    ['monthly', m.monthly],
                  ],
                  (repeat) => setDraft({ repeat }),
                  readOnly || limited || !draft.due || busy,
                )}
                {fieldMenu(
                  m.reminder,
                  draft.reminder ? m.morning : m.none,
                  [
                    ['none', m.none],
                    ['morning', m.morning],
                  ],
                  (value) => setDraft({ reminder: value === 'morning' }),
                  readOnly || limited || !draft.due || busy,
                )}
                <Text style={[styles.hint, { color: tokens.muted }]}>
                  {!draft.reminder
                    ? m.reminderHint
                    : !state.reminders || state.mute
                      ? m.reminderOff
                      : m.reminderReady}
                </Text>
                <Text style={[styles.heading, { color: tokens.fg }]}>
                  {m.labels}
                </Text>
                <TextInput
                  accessibilityLabel={m.labels}
                  value={draft.labels}
                  editable={!readOnly && !busy}
                  onChangeText={(labels) => setDraft({ labels })}
                  style={[
                    styles.input,
                    { color: tokens.fg, backgroundColor: tokens.tile },
                  ]}
                />
                <Text style={[styles.heading, { color: tokens.fg }]}>
                  {m.notes}
                </Text>
                <TextInput
                  accessibilityLabel={m.notes}
                  value={draft.notes}
                  multiline
                  editable={!readOnly && !busy}
                  onChangeText={(notes) => setDraft({ notes })}
                  style={[
                    styles.input,
                    {
                      color: tokens.fg,
                      backgroundColor: tokens.tile,
                      minHeight: 65,
                    },
                  ]}
                />
                <Text style={[styles.heading, { color: tokens.fg }]}>
                  {m.children}
                </Text>
                {draft.children.map((child, index) => (
                  <View key={child.id} style={{ marginBottom: 12 }}>
                    <TextInput
                      testID={`prototype-child-${index}`}
                      accessibilityLabel={`${m.title} ${index + 1}`}
                      value={child.title}
                      editable={!readOnly && !limited && !busy}
                      onChangeText={(title) => updateChild(index, { title })}
                      style={[
                        styles.input,
                        { color: tokens.fg, backgroundColor: tokens.tile },
                      ]}
                    />
                    {fieldMenu(
                      m.who,
                      whoName(child.who),
                      [
                        ['', m.unassigned],
                        ['Eric', m.me],
                        ['Anne', 'Anne'],
                      ],
                      (who) => updateChild(index, { who }),
                      readOnly || limited || busy,
                    )}
                    {actionButton(
                      `${m.due}: ${child.due ? day(child.due) : m.none}`,
                      () => {
                        setDateTarget(index)
                      },
                      undefined,
                      readOnly || limited || busy,
                    )}
                    <Text style={{ color: tokens.muted }}>
                      {child.done ? m.done : m.undo}
                    </Text>
                  </View>
                ))}
                {actionButton(
                  `+ ${m.addChild}`,
                  () =>
                    setDraft({
                      children: [
                        ...draft.children,
                        blank(`child-${Date.now()}`),
                      ],
                    }),
                  'prototype-add-child',
                  readOnly || limited || busy,
                )}
                <Text style={[styles.hint, { color: tokens.muted }]}>
                  {m.childHint}
                </Text>
              </>
            ) : null}
          </ScrollView>
        </PrototypeComposer>
      ) : null}

      {sheet === 'controls' ? (
        <NativeSheet
          title={m.controls}
          onClose={closeSheet}
          maxHeight={0.85}
          fill
        >
          <ScrollView>
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {m.controlsHint}
            </Text>
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {m.instructions}
            </Text>
            {switchRow(
              m.includeUnassigned,
              state.mineUnassigned,
              (mineUnassigned) => patchSample({ mineUnassigned }),
              'prototype-unassigned',
            )}
            {switchRow(
              m.providerDown,
              state.providerDown,
              (providerDown) => patchSample({ providerDown }),
              'prototype-outage',
            )}
            {switchRow(
              m.reminders,
              state.reminders,
              (reminders) => patchSample({ reminders }),
              'prototype-reminders',
            )}
            {switchRow(
              m.mute,
              state.mute,
              (mute) => patchSample({ mute }),
              'prototype-mute',
            )}
            {actionButton(
              m.state,
              () => setSheet('state'),
              'prototype-inspect',
            )}
            {actionButton(m.february, () => {
              resetSample()
              patchSample({ today: '2026-01-31' })
              setSheet(null)
            })}
            {actionButton(
              m.reset,
              () => {
                resetSample()
                setNotice('')
                setSheet(null)
              },
              'prototype-reset',
            )}
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {m.inspectHint}
            </Text>
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {m.nativeScope}
            </Text>
          </ScrollView>
        </NativeSheet>
      ) : null}
      {sheet === 'history' ? (
        <NativeSheet
          title={m.history}
          onClose={closeSheet}
          maxHeight={0.7}
          fill
        >
          <ScrollView>
            {state.history.length ? (
              state.history.map((entry, index) => (
                <View
                  key={`${entry.task.id}-${index}`}
                  style={[styles.field, { borderColor: tokens.border }]}
                >
                  <View>
                    <Text style={{ color: tokens.fg, fontSize: 17 }}>
                      {entry.task.title}
                    </Text>
                    <Text style={{ color: tokens.muted }}>
                      {entry.date}
                      {entry.next ? ` · ${m.next}: ${entry.next}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: tokens.muted }}>{m.emptyHistory}</Text>
            )}
          </ScrollView>
        </NativeSheet>
      ) : null}
      {sheet === 'state' ? (
        <NativeSheet title={m.state} onClose={closeSheet} maxHeight={0.85} fill>
          <ScrollView>
            <Text
              selectable
              style={{
                color: tokens.fg,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 11,
              }}
            >
              {JSON.stringify(state, null, 2)}
            </Text>
          </ScrollView>
        </NativeSheet>
      ) : null}
    </>
  )
}

function TaskRow({
  task,
  meta,
  source,
  overdue,
  disabled,
  actions,
  onMenu,
  onOpen,
  onToggle,
  onDelete,
}: {
  task: SampleTask
  meta: string
  source: string
  overdue: boolean
  disabled: boolean
  actions: MenuAction[]
  onMenu: (action: string) => void
  onOpen: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const m = t.tasksPrototype
  const swipe = useRef<SwipeableMethods>(null)
  const rowWidth = useRef(360)
  const fullSwipe = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .runOnJS(true)
    .onEnd((event) => {
      if (Math.abs(event.translationX) < rowWidth.current * 0.7) return
      swipe.current?.close()
      if (event.translationX > 0) onToggle()
      else onOpen()
    })
  const row = (
    <View
      onLayout={(event) => {
        rowWidth.current = event.nativeEvent.layout.width
      }}
      style={[
        styles.row,
        { backgroundColor: tokens.bg, borderColor: tokens.border },
      ]}
    >
      <Pressable
        testID={`prototype-complete-${task.id}`}
        accessibilityRole="checkbox"
        accessibilityLabel={`${m.complete}: ${task.title}`}
        accessibilityState={{ checked: task.done, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={styles.checkTarget}
      >
        <View
          style={[
            styles.circle,
            {
              borderColor: task.done ? tokens.accent : tokens.muted,
              backgroundColor: task.done ? tokens.accent : 'transparent',
              opacity: disabled ? 0.4 : 1,
            },
          ]}
        >
          {task.done ? (
            <UI_ICONS.Check size={15} color={tokens.onAccent} />
          ) : null}
        </View>
      </Pressable>
      <Pressable
        testID={`prototype-task-${task.id}`}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        style={styles.rowText}
      >
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text
            style={{
              flex: 1,
              color: tokens.fg,
              fontSize: 17,
              textDecorationLine: task.done ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </Text>
          {task.who ? (
            <View
              style={[
                styles.avatar,
                { backgroundColor: tokens.tintOf('home').bg },
              ]}
            >
              <Text
                style={{
                  color: tokens.accent,
                  fontSize: 10,
                  fontWeight: '600',
                }}
              >
                {task.who === 'Eric' ? 'EJ' : 'AN'}
              </Text>
            </View>
          ) : null}
        </View>
        {meta || source ? (
          <View style={styles.metaRow}>
            <Text
              style={{
                color: overdue ? tokens.danger : tokens.muted,
                fontSize: 12,
                flexShrink: 1,
              }}
            >
              {meta}
            </Text>
            {source ? (
              <Text
                style={{
                  color: tokens.muted,
                  fontSize: 12,
                  marginLeft: 'auto',
                }}
              >
                {source}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  )
  const action = (text: string, fn: () => void, color: string, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={() => {
        swipe.current?.close()
        fn()
      }}
      style={[styles.swipeAction, { backgroundColor: color }]}
    >
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
        {text}
      </Text>
    </Pressable>
  )
  if (Platform.OS === 'ios')
    return (
      <PrototypeNativeRow
        disabled={disabled}
        done={task.done}
        actions={actions}
        onMenu={onMenu}
        onToggle={onToggle}
        onOpen={onOpen}
        onDelete={onDelete}
      >
        {row}
      </PrototypeNativeRow>
    )
  return (
    <NativeContextMenu actions={actions} onAction={onMenu}>
      {disabled ? (
        row
      ) : (
        <GestureDetector gesture={fullSwipe}>
          <ReanimatedSwipeable
            ref={swipe}
            simultaneousWithExternalGesture={fullSwipe}
            friction={1}
            overshootFriction={1}
            animationOptions={{ damping: 30, stiffness: 350, mass: 0.5 }}
            leftThreshold={70}
            rightThreshold={70}
            overshootLeft
            overshootRight
            onSwipeableWillOpen={() => haptics.swipeThresholdPassed()}
            renderLeftActions={() =>
              action(
                task.done ? m.undo : m.complete,
                onToggle,
                '#3f7d4e',
                `prototype-swipe-complete-${task.id}`,
              )
            }
            renderRightActions={() => (
              <View style={{ flexDirection: 'row' }}>
                {action(
                  m.edit,
                  onOpen,
                  '#81602e',
                  `prototype-swipe-edit-${task.id}`,
                )}
                {action(
                  m.delete,
                  onDelete,
                  tokens.danger,
                  `prototype-swipe-delete-${task.id}`,
                )}
              </View>
            )}
          >
            {row}
          </ReanimatedSwipeable>
        </GestureDetector>
      )}
    </NativeContextMenu>
  )
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingVertical: 10 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  empty: { fontSize: 15, paddingVertical: 16 },
  notice: { padding: 12, borderRadius: 10, fontSize: 14, marginVertical: 8 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  rowText: { flex: 1, paddingVertical: 12, gap: 6 },
  checkTarget: { width: 44, minHeight: 52, justifyContent: 'center' },
  circle: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swipeAction: {
    minWidth: 85,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { flex: 1, fontSize: 16 },
  fieldValue: { fontSize: 15, flexShrink: 1, maxWidth: '55%' },
  titleInput: { fontSize: 22, paddingVertical: 12, minHeight: 56 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    minHeight: 44,
  },
  hint: { fontSize: 13, lineHeight: 19, marginVertical: 10 },
  input: { fontSize: 16, padding: 12, borderRadius: 10, minHeight: 48 },
})
