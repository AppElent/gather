/**
 * The sheet lab. Pick a mechanism, pick what goes in it, open it, and judge it
 * on the phone rather than on paper.
 *
 * **Deleted once the sheet decision is recorded in
 * `docs/mobile-interaction.md`.** That is its end condition, per CLAUDE.md's
 * one-shot rule: this is a measuring instrument, and it must not outlive the
 * measurement.
 *
 * The question it exists to settle: ADR-0018 requires that pressing Add never
 * changes the route, and a form sheet *is* a route. Whether that matters is a
 * claim about behaviour — does the tab move, do you come back where you were —
 * and behaviour is not decidable from documentation.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExpoUiSheet } from '../../../src/lab/ExpoUiSheet'
import { SheetBody } from '../../../src/lab/SheetBody'
import {
  CONTENT_KINDS,
  CONTENT_LABELS,
  type ContentKind,
} from '../../../src/lab/sheetContent'
import {
  SHEET_VARIANTS,
  type SheetVariant,
  VARIANTS,
} from '../../../src/lab/sheetVariants'
import { RADIUS, useTokens } from '../../../src/theme/tokens'

export default function SheetLab() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const [variant, setVariant] = useState<SheetVariant>('detents')
  const [kind, setKind] = useState<ContentKind>('rows')
  const [modalOpen, setModalOpen] = useState(false)
  const [expoUiOpen, setExpoUiOpen] = useState(false)
  const info = VARIANTS[variant]

  const open = () => {
    if (info.route) {
      router.push({ pathname: info.route, params: { kind } })
      return
    }
    if (variant === 'modal') setModalOpen(true)
    else setExpoUiOpen(true)
  }

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Text style={[styles.heading, { color: tokens.fg }]}>Sheet lab</Text>
      <Text style={[styles.blurb, { color: tokens.muted }]}>
        Five ways to present the Add launcher, four things to put in one. Open
        the same content in two mechanisms back to back — that comparison is the
        point, not any single sheet on its own.
      </Text>

      <Text style={[styles.label, { color: tokens.muted }]}>Mechanism</Text>
      <View style={styles.choices}>
        {SHEET_VARIANTS.map((option) => (
          <Choice
            key={option}
            label={VARIANTS[option].label}
            selected={option === variant}
            onPress={() => setVariant(option)}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: tokens.muted }]}>Content</Text>
      <View style={styles.choices}>
        {CONTENT_KINDS.map((option) => (
          <Choice
            key={option}
            label={CONTENT_LABELS[option]}
            selected={option === kind}
            onPress={() => setKind(option)}
          />
        ))}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Text style={[styles.what, { color: tokens.fg }]}>{info.what}</Text>
        <Text style={[styles.blurb, { color: tokens.muted }]}>
          {info.watch}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.open,
          { backgroundColor: tokens.fg },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.openLabel, { color: tokens.bg }]}>Open it</Text>
      </Pressable>

      <Text style={[styles.blurb, { color: tokens.muted }]}>
        Scroll this screen first, then open a sheet: whether the tab bar
        minimises behind it, and whether you land back on the same scroll
        position, are both part of the answer.
      </Text>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setModalOpen(false)} />
        <View style={[styles.handBuilt, { backgroundColor: tokens.surface }]}>
          <View style={styles.grabber} />
          <SheetBody
            kind={kind}
            title={VARIANTS.modal.label}
            watch={VARIANTS.modal.watch}
            fill={false}
          />
        </View>
      </Modal>

      <ExpoUiSheet
        open={expoUiOpen}
        kind={kind}
        onClose={() => setExpoUiOpen(false)}
      />
    </ScrollView>
  )
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const tokens = useTokens()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? tokens.fg : tokens.tile,
          borderColor: tokens.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          { color: selected ? tokens.bg : tokens.fg },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 10 },
  heading: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  blurb: { fontSize: 13, lineHeight: 19 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceLabel: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: RADIUS.tile,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 5,
    marginTop: 8,
  },
  what: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  open: {
    borderRadius: RADIUS.control,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  openLabel: { fontSize: 16, fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  handBuilt: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.45)',
  },
  pressed: { opacity: 0.6 },
})
