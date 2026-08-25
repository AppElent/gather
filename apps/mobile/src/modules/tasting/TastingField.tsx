/**
 * The renderer, and the whole reason the Kind spec is data.
 *
 * **This file has five components and never learns what a wine is.** It is
 * handed a `TastingFieldDef` and a value, and it draws the control that field
 * type asks for. Cheese, wine and beer differ only in which defs arrive.
 *
 * The five, and how each is drawn on a phone:
 *
 * - `select`, short vocabulary → a wrapping row of chips.
 * - `select`, long vocabulary → a row that opens a picker sheet. Which of the
 *   two is decided by `tastingSelectPresentation`, off the vocabulary's own
 *   length, so 28 wine regions can never be drawn as chips because somebody
 *   forgot a flag.
 * - `text` → one line, or a box where the field is `notes`.
 * - `number` → a right-aligned numeric field with its unit beside it.
 * - `scale` → five 44pt cells, 1 to 5. **Never half steps** — that precision
 *   belongs to the score and nowhere else.
 * - `tags` → chips plus "Add your own", because the vocabulary is a prompt and
 *   not a permission list (story 11).
 *
 * Values are the spec's own shapes and are handed up unchanged: a `string` for
 * text and select, a `number` for number and scale, a `string[]` for tags, and
 * `undefined` for a field nobody filled in — which is what makes
 * `normalizeTastingAttributes` on the way out a no-op rather than a rescue.
 */
import type {
  TastingAttributeValue,
  TastingFieldDef,
} from '@gather/core/tastings'
import {
  TASTING_VOCABULARIES,
  tastingSelectPresentation,
} from '@gather/core/tastings'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { TASTING_UI_ICONS } from './icons'
import { VocabularySheet } from './VocabularySheet'
import { fieldLabel, type TastingWords, term, unitLabel } from './words'

const SCALE_STEPS = [1, 2, 3, 4, 5]

export interface TastingFieldProps {
  field: TastingFieldDef
  value: TastingAttributeValue | undefined
  onChange: (next: TastingAttributeValue | undefined) => void
  disabled?: boolean
}

export function TastingField({
  field,
  value,
  onChange,
  disabled,
}: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.muted }]}>
        {fieldLabel(t.tastings, field).toUpperCase()}
      </Text>
      <Control
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </View>
  )
}

function Control(props: TastingFieldProps) {
  switch (props.field.type) {
    case 'select':
      return <SelectField {...props} />
    case 'tags':
      return <TagsField {...props} />
    case 'scale':
      return <ScaleField {...props} />
    case 'number':
      return <NumberField {...props} />
    case 'text':
      return <TextField {...props} />
  }
}

// ---------------------------------------------------------------------------

function Chip({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string
  on: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const tokens = useTokens('tasting')
  const tint = tokens.tintOf('tasting')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptics.selectionChanged()
        onPress()
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: on ? tint.bg : tokens.surface,
          borderColor: on ? tint.fg : tokens.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: on ? tint.fg : tokens.fg, fontWeight: on ? '700' : '400' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * One of a vocabulary. Chips where the list is short, a picker where it is
 * long — and pressing the chip that is already on clears the field, because
 * "not set" is a real answer and every attribute is optional.
 */
function SelectField({ field, value, onChange, disabled }: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const [picking, setPicking] = useState(false)
  const Chevron = UI_ICONS.ChevronDown
  const current = typeof value === 'string' ? value : undefined

  if (!field.vocabulary) return null

  if (tastingSelectPresentation(field.vocabulary) === 'chips') {
    return (
      <View style={styles.wrap}>
        {(TASTING_VOCABULARIES[field.vocabulary] as readonly string[]).map(
          (key) => (
            <Chip
              key={key}
              label={term(t.tastings, field.vocabulary, key)}
              on={current === key}
              disabled={disabled}
              onPress={() => onChange(current === key ? undefined : key)}
            />
          ),
        )}
      </View>
    )
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fieldLabel(t.tastings, field)}: ${
          current
            ? term(t.tastings, field.vocabulary, current)
            : t.tastings.composer.none
        }`}
        disabled={disabled}
        onPress={() => setPicking(true)}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.rowValue,
            { color: current ? tokens.fg : tokens.muted },
          ]}
        >
          {current
            ? term(t.tastings, field.vocabulary, current)
            : t.tastings.composer.none}
        </Text>
        <Chevron size={16} color={tokens.muted} strokeWidth={2.2} />
      </Pressable>
      {picking ? (
        <VocabularySheet
          title={fieldLabel(t.tastings, field)}
          vocabulary={field.vocabulary}
          selected={current}
          onSelect={(key) => {
            onChange(key ?? undefined)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  )
}

/**
 * Several of a vocabulary, **plus anything typed**.
 *
 * The "Add your own" row is not a fallback for a missing term — it is the
 * point. A wine that tastes of wet slate is a wine that tastes of wet slate,
 * and a shipped list that refused to say so would be a permission list.
 */
function TagsField({ field, value, onChange, disabled }: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const tint = tokens.tintOf('tasting')
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const Plus = TASTING_UI_ICONS.Plus

  const selected = Array.isArray(value) ? value : []
  const shipped = field.vocabulary
    ? (TASTING_VOCABULARIES[field.vocabulary] as readonly string[])
    : []
  // A typed entry keeps its place beside the shipped ones rather than being
  // shown in a separate "yours" group: once it is on, it is just a descriptor.
  const extras = selected.filter((entry) => !shipped.includes(entry))

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((entry) => entry !== key)
      : [...selected, key]
    onChange(next.length > 0 ? next : undefined)
  }

  function commit() {
    const typed = draft.trim()
    setDraft('')
    setTyping(false)
    if (!typed || selected.includes(typed)) return
    haptics.selectionChanged()
    onChange([...selected, typed])
  }

  return (
    <View style={styles.wrap}>
      {[...shipped, ...extras].map((key) => (
        <Chip
          key={key}
          label={term(t.tastings, field.vocabulary, key)}
          on={selected.includes(key)}
          disabled={disabled}
          onPress={() => toggle(key)}
        />
      ))}

      {typing ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          returnKeyType="done"
          placeholder={t.tastings.composer.addYourOwn}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.tastings.composer.addYourOwn}
          style={[
            styles.chip,
            styles.chipInput,
            {
              backgroundColor: tokens.surface,
              borderColor: tint.fg,
              color: tokens.fg,
            },
          ]}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.tastings.composer.addYourOwn}
          disabled={disabled}
          onPress={() => setTyping(true)}
          style={({ pressed }) => [
            styles.chip,
            styles.chipDashed,
            { borderColor: tokens.border },
            pressed && styles.pressed,
          ]}
        >
          <Plus size={13} color={tokens.muted} strokeWidth={2.2} />
          <Text style={[styles.chipText, { color: tokens.muted }]}>
            {t.tastings.composer.addYourOwn}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

/**
 * 1 to 5, whole steps, five equal cells.
 *
 * Pressing the cell that is already on clears it, for `SelectField`'s reason:
 * an observation nobody made is different from a 3.
 */
function ScaleField({ field, value, onChange, disabled }: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const tint = tokens.tintOf('tasting')
  const current = typeof value === 'number' ? value : undefined

  return (
    <View style={styles.scale}>
      {SCALE_STEPS.map((step) => {
        const on = current === step
        return (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={`${fieldLabel(t.tastings, field)} ${step}`}
            disabled={disabled}
            onPress={() => {
              haptics.selectionChanged()
              onChange(on ? undefined : step)
            }}
            style={({ pressed }) => [
              styles.scaleCell,
              {
                backgroundColor: on ? tint.bg : tokens.surface,
                borderColor: on ? tint.fg : tokens.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.scaleText,
                {
                  color: on ? tint.fg : tokens.fg,
                  fontWeight: on ? '700' : '400',
                },
              ]}
            >
              {step}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * A figure, with its unit beside it.
 *
 * The draft is held as the typed string so a half-typed "14." survives the
 * keystroke that would otherwise parse to 14 and snap the cursor. Only a
 * finite number is handed up; anything else is `undefined`, which the door
 * then treats as a field nobody filled in.
 */
function NumberField({ field, value, onChange, disabled }: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const [draft, setDraft] = useState(
    typeof value === 'number' ? String(value) : '',
  )
  const unit = unitLabel(t.tastings, field)

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <TextInput
        value={draft}
        onChangeText={(next) => {
          setDraft(next)
          const parsed = Number(next.replace(',', '.'))
          onChange(next.trim() && Number.isFinite(parsed) ? parsed : undefined)
        }}
        editable={!disabled}
        keyboardType="decimal-pad"
        placeholder={t.tastings.composer.none}
        placeholderTextColor={tokens.muted}
        accessibilityLabel={fieldLabel(t.tastings, field)}
        style={[styles.numberInput, { color: tokens.fg }]}
      />
      {unit ? (
        <Text style={[styles.unit, { color: tokens.muted }]}>{unit}</Text>
      ) : null}
    </View>
  )
}

/** Prose. A box for the notes, one line for anything else. */
function TextField({ field, value, onChange, disabled }: TastingFieldProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const multiline = field.key === 'notes'

  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChangeText={(next) => onChange(next ? next : undefined)}
      editable={!disabled}
      multiline={multiline}
      placeholder={
        multiline
          ? t.tastings.composer.notesPlaceholder
          : fieldLabel(t.tastings, field)
      }
      placeholderTextColor={tokens.muted}
      accessibilityLabel={fieldLabel(t.tastings, field)}
      style={[
        styles.row,
        multiline ? styles.textArea : styles.textLine,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          color: tokens.fg,
        },
      ]}
    />
  )
}

/**
 * What one field reads as, for the facts grid on a subject's page.
 *
 * A separate function rather than a `disabled` pass through the controls
 * above, because a greyed-out chip row is not how a fact reads — it reads as a
 * label and a value, and the grid draws it as one. `null` is a field nobody
 * filled in, which the grid leaves out entirely rather than showing empty.
 */
export function tastingFieldText(
  t: TastingWords,
  field: TastingFieldDef,
  value: TastingAttributeValue | undefined,
): string | null {
  if (value === undefined) return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map((key) => term(t, field.vocabulary, key)).join(', ')
  }
  if (typeof value === 'number') {
    const unit = unitLabel(t, field)
    return unit ? `${value}${unit === '%' ? '' : ' '}${unit}` : String(value)
  }
  if (field.type === 'select') return term(t, field.vocabulary, value)
  return value
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDashed: { borderStyle: 'dashed', borderWidth: 1 },
  chipInput: { minWidth: 140, fontSize: 14, borderWidth: 1 },
  chipText: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowValue: { flex: 1, fontSize: 16 },
  numberInput: { flex: 1, fontSize: 16 },
  unit: { fontSize: 15 },
  textLine: { fontSize: 16 },
  textArea: {
    minHeight: 74,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 15,
    alignItems: 'flex-start',
    textAlignVertical: 'top',
  },
  scale: { flexDirection: 'row', gap: 6 },
  scaleCell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scaleText: { fontSize: 15 },
  pressed: { opacity: 0.6 },
})
