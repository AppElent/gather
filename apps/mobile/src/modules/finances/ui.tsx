/**
 * The shapes every Finances screen is made of.
 *
 * Grouped lists, exactly as Settings draws them: a small sentence-case section
 * title, a hairline-bordered card, and rows inside it that are 48pt tall and
 * separated by a hairline. The phone owns its look and these are plain React
 * Native primitives styled from `theme/tokens` (ADR-0017) — the point is that
 * no screen invents its own row.
 *
 * Two things every money screen needs and gets here:
 *
 * - **A figure is drawn tabular and spoken in full.** `accessibilityLabel`
 *   carries the label and the amount as one sentence, because "€ 2,140" beside
 *   "Rent" is two focus stops that only make sense together.
 * - **A result ends on the same muted line.** `Notice` is that line, and
 *   `Disclaimer` is the one sentence the Module never omits.
 */

import type { ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useI18n } from '../../i18n'
import type { Glyph } from '../../theme/glyph'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { ModuleTile } from '../../ui/module-tile'
import { FINANCE_ICONS } from './icons'

/** The Module's accent. Money is one of the four catalogue groups. */
export function useMoneyTokens() {
  return useTokens('money')
}

export function Section({ title }: { title: string }) {
  const tokens = useMoneyTokens()
  return (
    <Text
      accessibilityRole="header"
      style={[styles.section, { color: tokens.muted }]}
    >
      {title}
    </Text>
  )
}

export function Card({
  children,
  padded = false,
}: {
  children: ReactNode
  padded?: boolean
}) {
  const tokens = useMoneyTokens()
  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      {children}
    </View>
  )
}

export interface RowProps {
  label: string
  sub?: string
  /** The figure on the right. Already formatted. */
  value?: string
  /** Draws the value in ink rather than muted — a money figure, not a setting. */
  emphasis?: boolean
  onPress?: () => void
  /** Shown when the row leads somewhere. */
  chevron?: boolean
  leading?: ReactNode
  /** A second line under the value, for a delta or a staleness note. */
  valueSub?: string
  valueTone?: 'default' | 'up' | 'down'
  /** A row whose figure the app worked out rather than anybody typing it. */
  derived?: boolean
  last?: boolean
}

export function Row({
  label,
  sub,
  value,
  emphasis = false,
  onPress,
  chevron = false,
  leading,
  valueSub,
  valueTone = 'default',
  derived = false,
  last = false,
}: RowProps) {
  const tokens = useMoneyTokens()
  const ChevronRight = UI_ICONS.ChevronRight
  const toneColor =
    valueTone === 'up'
      ? tokens.ink
      : valueTone === 'down'
        ? tokens.danger
        : tokens.muted

  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tokens.ink }]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: tokens.muted }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <View style={styles.rowValue}>
          <Text
            style={[
              styles.value,
              { color: emphasis ? tokens.ink : tokens.muted },
            ]}
          >
            {value}
          </Text>
          {valueSub ? (
            <Text style={[styles.valueSub, { color: toneColor }]}>
              {valueSub}
            </Text>
          ) : null}
        </View>
      ) : null}
      {chevron ? (
        <ChevronRight
          size={18}
          color={tokens.muted}
          strokeWidth={1.8}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
    </>
  )

  // One focus stop, one sentence: a label and its figure only mean anything
  // together, so the reader is given them together.
  const spoken = [label, sub, value, valueSub].filter(Boolean).join(', ')
  const rowStyle = [
    styles.row,
    !last && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.hair,
    },
    derived && { backgroundColor: tokens.surface2 },
  ]

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={spoken} style={rowStyle}>
        {body}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

/** The last row of a card, and the only place a Finances screen adds anything. */
export function AddRow({
  label,
  onPress,
  last = true,
}: {
  label: string
  onPress: () => void
  last?: boolean
}) {
  const tokens = useMoneyTokens()
  const Plus = FINANCE_ICONS.Plus
  const tint = tokens.tintOf('money')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.hair,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.leading}>
        <Plus size={17} color={tint.text} strokeWidth={2.2} />
      </View>
      <Text style={[styles.rowLabel, { color: tint.text, flex: 1 }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** The headline figure a screen is about. */
export function Figure({
  caption,
  amount,
  sub,
  large = true,
}: {
  caption?: string
  amount: string
  sub?: string
  large?: boolean
}) {
  const tokens = useMoneyTokens()
  return (
    <View style={styles.figure}>
      {caption ? (
        <Text style={[styles.caption, { color: tokens.muted }]}>{caption}</Text>
      ) : null}
      <Text
        style={[
          large ? styles.figureLarge : styles.figureSmall,
          { color: tokens.ink },
        ]}
      >
        {amount}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: tokens.muted }]}>{sub}</Text>
      ) : null}
    </View>
  )
}

export function Notice({ children }: { children: string }) {
  const tokens = useMoneyTokens()
  return (
    <Text style={[styles.notice, { color: tokens.muted }]}>{children}</Text>
  )
}

/** The one sentence every result in this Module ends on. */
export function Disclaimer() {
  const { t } = useI18n()
  return <Notice>{t.finances.disclaimer}</Notice>
}

/** Amber, an age, and a way to retry — never a spinner over live figures. */
export function StaleBanner({
  text,
  onRetry,
}: {
  text: string
  onRetry?: () => void
}) {
  const tokens = useMoneyTokens()
  const Alert = FINANCE_ICONS.Alert
  return (
    <Pressable
      accessibilityRole={onRetry ? 'button' : undefined}
      accessibilityLabel={text}
      onPress={onRetry}
      style={styles.stale}
    >
      <Alert size={13} color={tokens.danger} strokeWidth={2} />
      <Text style={[styles.staleText, { color: tokens.danger }]}>{text}</Text>
    </Pressable>
  )
}

/**
 * Nothing yet, and one button that makes the first thing.
 *
 * The glyph sits on the Module's `tile-l` tile, like the tile under any
 * Module screen's title, never bare in a group colour.
 *
 * Empty is never off: there is no switch anywhere in Finances (ADR-0022), so
 * an empty screen invites rather than explains its own absence.
 */
export function EmptyState({
  glyph,
  title,
  body,
  actionLabel,
  onAction,
}: {
  glyph: Glyph
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  const tokens = useMoneyTokens()
  return (
    <View style={styles.empty}>
      <ModuleTile group="money" glyph={glyph} size="l" />
      <Text
        accessibilityRole="header"
        style={[styles.emptyTitle, { color: tokens.ink }]}
      >
        {title}
      </Text>
      <Text style={[styles.emptyBody, { color: tokens.muted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  const tokens = useMoneyTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: tokens.accent },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: tokens.onAccent }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * The answer, pinned under the form that produces it.
 *
 * A sibling of the scroll view rather than a child, because the large title
 * only collapses against a scroll view that is the screen's first subview.
 */
export function AnswerBar({
  amount,
  unit,
  sub,
  action,
}: {
  amount: string
  unit?: string
  sub?: string
  action?: ReactNode
}) {
  const tokens = useMoneyTokens()
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: tokens.surface, borderTopColor: tokens.hair },
      ]}
    >
      <View style={styles.barText}>
        <Text style={[styles.barAmount, { color: tokens.ink }]}>
          {amount}
          {unit ? (
            <Text style={[styles.barUnit, { color: tokens.ink }]}> {unit}</Text>
          ) : null}
        </Text>
        {sub ? (
          <Text style={[styles.barSub, { color: tokens.muted }]}>{sub}</Text>
        ) : null}
      </View>
      {action}
    </View>
  )
}

/** A chip in a closed set — a rate to compare, a person to include. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const tokens = useMoneyTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tokens.ink : tokens.surface,
          borderColor: selected ? tokens.ink : tokens.hair,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? tokens.onInk : tokens.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** One labelled input inside a sheet. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoFocus = false,
  prefix,
  suffix,
}: {
  label: string
  value: string
  onChangeText: (next: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation'
  autoFocus?: boolean
  prefix?: string
  suffix?: string
}) {
  const tokens = useMoneyTokens()
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: tokens.muted }]}>{label}</Text>
      <View style={styles.fieldInput}>
        {prefix ? (
          <Text style={[styles.affix, { color: tokens.muted }]}>{prefix}</Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.muted}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          style={[styles.input, { color: tokens.ink }]}
        />
        {suffix ? (
          <Text style={[styles.affix, { color: tokens.muted }]}>{suffix}</Text>
        ) : null}
      </View>
    </View>
  )
}

/** The body of every Finances screen: a scroll view that is the first subview. */
export function ScreenScroll({
  children,
  bottomInset = 24,
}: {
  children: ReactNode
  bottomInset?: number
}) {
  const tokens = useMoneyTokens()
  return (
    <ScrollView
      style={{ backgroundColor: tokens.ground }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  section: {
    ...TYPE.footnoteStrong,
    marginTop: 14,
    marginBottom: 2,
    marginLeft: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  cardPadded: { paddingVertical: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 8,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...TYPE.body },
  rowValue: { alignItems: 'flex-end' },
  value: { ...TYPE.subhead, ...TABULAR, maxWidth: 160, textAlign: 'right' },
  valueSub: { ...TYPE.footnote, ...TABULAR },
  sub: { ...TYPE.footnote },
  leading: { width: 24, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  figure: { gap: 3 },
  caption: { ...TYPE.footnoteStrong },
  figureLarge: { ...TYPE.numeralL, letterSpacing: -0.8 },
  figureSmall: { ...TYPE.title2, ...TABULAR, letterSpacing: -0.4 },
  notice: { ...TYPE.footnote, marginTop: 10, paddingHorizontal: 4 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  staleText: { ...TYPE.footnote, flex: 1 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyTitle: { ...TYPE.title2, letterSpacing: -0.4 },
  emptyBody: {
    ...TYPE.subhead,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 6,
  },
  primaryLabel: { ...TYPE.bodyStrong },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barText: { flex: 1 },
  barAmount: { ...TYPE.numeralL, letterSpacing: -0.5 },
  barUnit: { ...TYPE.bodyStrong },
  barSub: { ...TYPE.footnote },
  chip: {
    minHeight: 40,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { ...TYPE.bodyStrong },
  field: { gap: 4, paddingVertical: 8 },
  fieldLabel: { ...TYPE.footnote },
  fieldInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  affix: { ...TYPE.body },
  input: { ...TYPE.body, flex: 1, paddingVertical: 6 },
})
