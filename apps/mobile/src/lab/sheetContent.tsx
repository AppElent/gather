/**
 * The four things a sheet in gather might have to hold.
 *
 * **This whole directory is a measuring instrument and is deleted when the
 * sheet decision is recorded in `docs/mobile-interaction.md`.** It is one-shot
 * code and says so, per CLAUDE.md.
 *
 * The kinds are not arbitrary: they are ADR-0018's quick-action kinds plus the
 * case that breaks sheets. `rows` is the launcher as it stands. `inline` is the
 * `row` kind — a field that appears inside the sheet, which is where a keyboard
 * meets a detent. `form` is the `sheet` kind. `long` is the one nothing in
 * gather has yet, and the one that decides whether a drag scrolls the content
 * or dismisses the sheet.
 *
 * English only, deliberately: these strings name mechanisms rather than address
 * a user, nobody ships this screen, and putting throwaway copy in both locale
 * trees would outlive the throwaway code.
 */
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { RADIUS, useTokens } from '../theme/tokens'

export const CONTENT_KINDS = ['rows', 'inline', 'form', 'long'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export const CONTENT_LABELS: Record<ContentKind, string> = {
  rows: 'Five rows',
  inline: 'Row + field',
  form: 'Three fields',
  long: 'Long list',
}

/** What to look for in each, so the judgement is about behaviour and not taste. */
export const CONTENT_WATCH: Record<ContentKind, string> = {
  rows: 'Does it size itself sensibly, and does the material read as iOS?',
  inline:
    'The keyboard is the test. Does the sheet move, resize, or get covered?',
  form: 'Can you reach the Save button with the keyboard up?',
  long: 'Does dragging scroll the list, or dismiss the sheet?',
}

const ACTIONS = [
  'Add a task',
  'Log a meal',
  'Import from a link',
  'Write a recipe',
  'Scan a barcode',
]

export function SheetContent({
  kind,
  fill,
}: {
  kind: ContentKind
  /** `false` in a fit-to-contents sheet, where a `flex: 1` list would measure as zero. */
  fill: boolean
}) {
  if (kind === 'rows') return <Rows />
  if (kind === 'inline') return <Inline />
  if (kind === 'form') return <Form />
  return <LongList fill={fill} />
}

function Rows() {
  const tokens = useTokens()

  return (
    <View>
      {ACTIONS.map((action) => (
        <View key={action} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: tokens.tile }]} />
          <Text style={[styles.rowLabel, { color: tokens.fg }]}>{action}</Text>
        </View>
      ))}
    </View>
  )
}

function Inline() {
  const tokens = useTokens()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  return (
    <View>
      {ACTIONS.map((action) => (
        <View key={action}>
          <Pressable
            style={styles.row}
            onPress={() => setOpen(action === ACTIONS[0])}
          >
            <View style={[styles.dot, { backgroundColor: tokens.tile }]} />
            <Text style={[styles.rowLabel, { color: tokens.fg }]}>
              {action}
            </Text>
            {action === ACTIONS[0] ? (
              <Text style={[styles.hint, { color: tokens.muted }]}>tap me</Text>
            ) : null}
          </Pressable>
          {open && action === ACTIONS[0] ? (
            <TextInput
              autoFocus
              value={value}
              onChangeText={setValue}
              placeholder="What needs doing?"
              placeholderTextColor={tokens.muted}
              style={[
                styles.input,
                {
                  color: tokens.fg,
                  backgroundColor: tokens.bg,
                  borderColor: tokens.border,
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

function Form() {
  const tokens = useTokens()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const fields = ['Title', 'Amount', 'Note']

  return (
    <View style={styles.form}>
      {fields.map((field, index) => (
        <TextInput
          key={field}
          autoFocus={index === 0}
          value={draft[field] ?? ''}
          onChangeText={(next) =>
            setDraft((current) => ({ ...current, [field]: next }))
          }
          placeholder={field}
          placeholderTextColor={tokens.muted}
          returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
          style={[
            styles.input,
            {
              color: tokens.fg,
              backgroundColor: tokens.bg,
              borderColor: tokens.border,
            },
          ]}
        />
      ))}
      <View style={[styles.save, { backgroundColor: tokens.fg }]}>
        <Text style={[styles.saveLabel, { color: tokens.bg }]}>Save</Text>
      </View>
    </View>
  )
}

function LongList({ fill }: { fill: boolean }) {
  const tokens = useTokens()

  return (
    <ScrollView style={fill ? styles.longFill : styles.longCapped}>
      {Array.from({ length: 30 }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: tokens.tile }]} />
          <Text style={[styles.rowLabel, { color: tokens.fg }]}>
            Item {index + 1}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dot: { width: 36, height: 36, borderRadius: RADIUS.tile },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13 },
  form: { gap: 10, paddingVertical: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  save: {
    borderRadius: RADIUS.control,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveLabel: { fontSize: 15, fontWeight: '700' },
  /** A fixed-height sheet: take the room it has, so the drag test is real. */
  longFill: { flex: 1 },
  /** A fit-to-contents sheet has no height of its own to fill, so cap it. */
  longCapped: { maxHeight: 520 },
})
