/**
 * Adding a Child — which *is* the Baby log's setup (ADR-0022).
 *
 * Three steps rather than one long form. It is a one-time act with a clear end,
 * and step 2 needs room to say the thing that would otherwise be a caption
 * nobody reads: turning a type off later changes what you are offered and never
 * what is already logged.
 *
 * The steps are state rather than three routes: a wizard's Back must return to
 * the previous *question*, not unwind a navigation stack that also contains the
 * screen you started from.
 */
import {
  BABY_EVENT_TYPES,
  type BabyEventType,
  declinedEventTypes,
} from '@gather/core/domain'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { babyChildKey, writePreference } from '../../prefs/localPreference'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { EVENT_ICONS } from './icons'
import { ListPicker, type PickedList } from './ListPicker'

/** What a newborn's household reaches for. The rest are a tap away. */
const DEFAULT_TRACKED: BabyEventType[] = [
  'feeding',
  'diaper',
  'sleep',
  'temperature',
  'note',
]

const TOTAL_STEPS = 3

export function CreateChild() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const { group } = useGroup()
  const groupSlug = group.slug
  const tint = tokens.tintOf('home')

  const create = useMutation(api.babies.create)
  const lists = useQuery(api.taskLists.list, { groupSlug })

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<'female' | 'male' | 'unspecified'>(
    'unspecified',
  )
  const [tracked, setTracked] = useState<BabyEventType[]>(DEFAULT_TRACKED)
  const [todos, setTodos] = useState<PickedList>({ kind: 'new' })
  const [questions, setQuestions] = useState<PickedList>({ kind: 'new' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const text = t.baby.log.create
  const trimmed = name.trim()

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const id = await create({
        groupSlug,
        name: trimmed,
        birthDate,
        sex,
        // The record holds what was turned *off*, so a type added to the
        // catalogue later is offered to this child rather than missing from it.
        untrackedTypes: declinedEventTypes(tracked),
        taskListId:
          todos.kind === 'existing'
            ? (todos.listId as Id<'taskLists'>)
            : undefined,
        questionsListId:
          questions.kind === 'existing'
            ? (questions.listId as Id<'taskLists'>)
            : undefined,
      })
      // Open the log on the Child that was just added rather than on whichever
      // one happens to sort first.
      writePreference(babyChildKey(groupSlug), id)
      router.back()
    } catch {
      setError(text.failed)
      setSaving(false)
    }
  }

  const canContinue =
    step === 1 ? trimmed.length > 0 && birthDate.length > 0 : true

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => (step === 1 ? router.back() : setStep(step - 1))}
          style={styles.headerSide}
        >
          <Text style={[styles.headerAction, { color: tint.fg }]}>
            {step === 1 ? text.cancel : text.back}
          </Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.headerTitle, { color: tokens.fg }]}
        >
          {step === 1
            ? text.aboutTitle
            : step === 2
              ? t.baby.log.tracked.title
              : t.baby.log.lists.title}
        </Text>
        <Text
          style={[
            styles.headerSide,
            styles.headerStep,
            { color: tokens.muted },
          ]}
        >
          {fmt(text.step, { current: step, total: TOTAL_STEPS })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            <Field label={t.baby.log.form.name}>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder={t.baby.log.form.name}
                placeholderTextColor={tokens.muted}
                style={[
                  styles.input,
                  {
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                    color: tokens.fg,
                  },
                ]}
              />
            </Field>
            <Field label={t.baby.log.form.birthDate}>
              <TextInput
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tokens.muted}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.input,
                  {
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                    color: tokens.fg,
                  },
                ]}
              />
            </Field>
            <Field label={t.baby.log.form.sex}>
              <View style={styles.segments}>
                {(
                  [
                    ['female', t.baby.log.form.sexFemale],
                    ['male', t.baby.log.form.sexMale],
                    ['unspecified', t.baby.log.form.sexUnspecified],
                  ] as const
                ).map(([value, label]) => {
                  const on = sex === value
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setSex(value)}
                      style={[
                        styles.segment,
                        {
                          borderColor: on ? tint.fg : tokens.border,
                          backgroundColor: on ? tint.bg : tokens.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: on ? tint.fg : tokens.fg,
                            fontWeight: on ? '700' : '500',
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.intro, { color: tokens.muted }]}>
              {fmt(t.baby.log.tracked.subtitle, { name: trimmed })}{' '}
              {t.baby.log.tracked.settingsHint}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                },
              ]}
            >
              {BABY_EVENT_TYPES.map((type) => {
                const Icon = EVENT_ICONS[type]
                const on = tracked.includes(type)
                return (
                  <View
                    key={type}
                    style={[
                      styles.trackRow,
                      { borderBottomColor: tokens.border },
                    ]}
                  >
                    <Icon size={20} color={tint.fg} strokeWidth={1.9} />
                    <Text style={[styles.trackLabel, { color: tokens.fg }]}>
                      {t.baby.eventTypes[type]}
                    </Text>
                    <Switch
                      value={on}
                      accessibilityLabel={t.baby.eventTypes[type]}
                      onValueChange={(next) =>
                        setTracked((prev) =>
                          next
                            ? [...prev, type]
                            : prev.filter((each) => each !== type),
                        )
                      }
                      trackColor={{ false: tokens.tile, true: tint.fg }}
                    />
                  </View>
                )
              })}
            </View>
            <View style={[styles.notice, { backgroundColor: tokens.tile }]}>
              <UI_ICONS.CircleAlert
                size={18}
                color={tokens.muted}
                strokeWidth={1.9}
              />
              <Text style={[styles.noticeText, { color: tokens.muted }]}>
                {t.baby.log.tracked.keepsEntries}
              </Text>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.intro, { color: tokens.muted }]}>
              {fmt(t.baby.log.lists.subtitle, { name: trimmed })}
            </Text>
            <ListPicker
              title={t.baby.log.lists.todos}
              defaultName={`${trimmed} ${t.baby.log.lists.todos.toLowerCase()}`}
              lists={lists ?? []}
              value={todos}
              onChange={setTodos}
              groupName={group.name}
            />
            <ListPicker
              title={t.baby.log.lists.questions}
              defaultName={`${trimmed} ${t.baby.log.lists.questions.toLowerCase()}`}
              lists={lists ?? []}
              value={questions}
              onChange={setQuestions}
              groupName={group.name}
            />
          </>
        ) : null}

        {error ? (
          <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!canContinue || saving}
          onPress={() => (step < TOTAL_STEPS ? setStep(step + 1) : submit())}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: tint.fg },
            (!canContinue || saving || pressed) && styles.dimmed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={tokens.surface} />
          ) : (
            <Text style={[styles.primaryText, { color: tokens.surface }]}>
              {step < TOTAL_STEPS
                ? text.next
                : fmt(text.finish, { name: trimmed })}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const tokens = useTokens('home')
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerSide: { flex: 1 },
  headerAction: { fontSize: 17 },
  headerStep: { fontSize: 15, textAlign: 'right' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 20 },
  intro: { fontSize: 14.5, lineHeight: 21 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '600',
  },
  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.control,
  },
  segmentText: { fontSize: 15 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackLabel: { flex: 1, fontSize: 16 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.tile,
  },
  noticeText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  error: { fontSize: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16.5, fontWeight: '700' },
  dimmed: { opacity: 0.55 },
})
