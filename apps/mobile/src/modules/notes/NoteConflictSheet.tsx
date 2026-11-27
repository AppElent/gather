/**
 * Another Member saved this note while this person was writing (APP-347).
 * Nothing was overwritten: both versions are shown, and the person keeps
 * theirs, keeps the other, or copies theirs to a note of its own.
 *
 * Swiping it away chooses nothing: the text stays unsaved on screen and the
 * autosave line says so, and tapping that line opens this again.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import type { TheirNote } from './noteConflict'
import type { NoteText } from './noteText'

export function NoteConflictSheet({
  mine,
  theirs,
  busy,
  onKeepMine,
  onKeepTheirs,
  onCopyMine,
  onClose,
}: {
  mine: NoteText
  theirs: TheirNote
  busy: boolean
  onKeepMine: () => void
  onKeepTheirs: () => void
  onCopyMine: () => void
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.notes.conflict

  return (
    <NativeSheet
      title={words.title}
      subtitle={
        theirs.updatedByName === null
          ? words.changedBySomeone
          : fmt(words.changedBy, { name: theirs.updatedByName })
      }
      onClose={onClose}
      maxHeight={0.85}
      fill
    >
      <ScrollView style={styles.versions} contentContainerStyle={styles.gap}>
        <Version testID="note-conflict-theirs" label={words.theirs} text={theirs} />
        <Version testID="note-conflict-mine" label={words.mine} text={mine} />
      </ScrollView>
      <View style={styles.actions}>
        <Pressable
          testID="note-conflict-keep-mine"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onKeepMine}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: tokens.accent },
            (pressed || busy) && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: tokens.onAccent }]}>
            {words.keepMine}
          </Text>
        </Pressable>
        <Pressable
          testID="note-conflict-keep-theirs"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onKeepTheirs}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: tokens.surface2 },
            (pressed || busy) && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: tokens.ink }]}>
            {words.keepTheirs}
          </Text>
        </Pressable>
        <Pressable
          testID="note-conflict-copy-mine"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onCopyMine}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: tokens.surface2 },
            (pressed || busy) && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: tokens.ink }]}>
            {words.copyMine}
          </Text>
        </Pressable>
      </View>
    </NativeSheet>
  )
}

function Version({
  testID,
  label,
  text,
}: {
  testID: string
  label: string
  text: NoteText
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  return (
    <View
      testID={testID}
      style={[
        styles.version,
        { backgroundColor: tokens.ground, borderColor: tokens.hair },
      ]}
    >
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      <Text style={[styles.versionTitle, { color: tokens.ink }]}>
        {text.title || t.notes.untitled}
      </Text>
      {text.body ? (
        <Text style={[styles.versionBody, { color: tokens.ink }]}>
          {text.body}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  versions: { flex: 1 },
  gap: { gap: 10, paddingBottom: 12 },
  version: {
    padding: 12,
    gap: 4,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...TYPE.footnoteStrong },
  versionTitle: { ...TYPE.bodyStrong },
  versionBody: { ...TYPE.body },
  actions: { gap: 8, paddingTop: 4 },
  action: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
