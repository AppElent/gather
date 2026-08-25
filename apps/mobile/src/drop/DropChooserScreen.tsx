/**
 * The one question a Drop asks: where does this go?
 *
 * A pushed screen rather than a sheet, and that is not a style choice. Back
 * from a destination that refused the Drop has to return here **with the same
 * Drop still pending**, which is what makes recovery work for failures nobody
 * predicted — including ones nobody has written yet. A sheet dismissed by a
 * navigation cannot promise that; a screen in the stack can.
 *
 * ## Nothing expensive happens here
 *
 * Stage one is drawn entirely from the static registry, so it needs no Convex
 * data of its own and can be read on a cold start. A target whose Module is
 * empty is still listed, because ADR-0022 says an empty Module invites you to
 * make its first thing — and filtering by content would make this screen wait
 * for queries it has no other reason to run.
 *
 * ## The Drop names its save location
 *
 * The Group is named before anything is written, and the app follows the Drop
 * there **after** the save rather than the moment somebody taps a name in the
 * sheet. Two reasons: an abandoned Drop must leave nothing behind, including a
 * silently changed Group; and `docs/mobile-interaction.md` says the
 * confirmation *is* the screen changing, so arriving in the new Group is what
 * says the save worked. ADR-0015 stands — the Group is still a place, and this
 * introduces no per-write Group anywhere else.
 *
 * ## One destination keeps the Drop
 *
 * `recipe-import` writes nothing here: the importer reads the page on its own
 * screen, and it can fail there. So that one alone is pushed *on top of* this
 * chooser with the Drop still pending, and Back returns to a live list of
 * somewhere else to put the link. Every other destination has already written
 * by the time it navigates, and a failure never leaves this screen at all.
 */
import { moduleById } from '@gather/core/modules'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { haptics } from '../feedback/haptics'
import { useGroup } from '../group/GroupProvider'
import { fmt, useI18n } from '../i18n'
import { MODULE_ICONS, UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'
import { DropGroupSheet } from './DropGroupSheet'
import { useDrop } from './DropProvider'
import {
  type Drop,
  dropDisplayHost,
  dropDisplayTitle,
  dropFromLink,
} from './drop'
import { type RankedDropTarget, targetsForDrop } from './dropTargets'
import { dropPickHref } from './paths'
import { type DropProblem, useDropCommit } from './useDropCommit'

export function DropChooserScreen() {
  const tokens = useTokens()
  const router = useRouter()
  const { t } = useI18n()
  const { group, groups, setGroup } = useGroup()
  const { pending, clear, offer } = useDrop()
  const commit = useDropCommit()
  // The harness. `agent-device` cannot drive a share sheet, so
  // `gather://drop?url=…` stands in for one — the same chooser, over the same
  // provider, with a payload that did not come from another app (ADR-0028).
  const { url: seedUrl, text: seedText } = useLocalSearchParams<{
    url?: string
    text?: string
  }>()
  const text = t.drop

  const [selected, setSelected] = useState<string | null>(null)
  const [saveGroup, setSaveGroup] = useState(group.slug)
  const [naming, setNaming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<DropProblem | 'failed' | null>(null)

  const drop = pending?.drop ?? null

  // A chooser with nothing to choose for is not a screen — unless the address
  // carried a payload, which is the harness above. Reached otherwise by
  // dismissing the Drop, or by returning here after it was answered.
  useEffect(() => {
    if (drop) return
    const seeded = dropFromLink({ url: seedUrl, text: seedText })
    if (seeded) offer(seeded)
    else router.replace('/home')
    // Destructured rather than depending on the params object, which
    // `useLocalSearchParams` rebuilds every render.
  }, [drop, offer, router, seedUrl, seedText])

  const targets = drop
    ? targetsForDrop({
        kind: drop.kind,
        host: drop.kind === 'url' ? drop.host : null,
      })
    : []
  const chosen =
    targets.find((target) => target.id === selected) ??
    targets.find((target) => target.preselected) ??
    targets[0]
  const named = groups.find((each) => each.slug === saveGroup) ?? group

  async function confirm() {
    if (!chosen || !drop || saving) return

    // Stage two is a screen, not a write. Nothing has been uploaded or created
    // at this point, so backing out of it costs the household nothing.
    if (chosen.picks !== 'none') {
      router.push(dropPickHref(chosen.id, saveGroup))
      return
    }

    setSaving(true)
    setProblem(null)
    try {
      const result = await commit({
        target: chosen,
        drop,
        groupSlug: saveGroup,
      })
      if (!result.ok) {
        haptics.actionFailed()
        setProblem(result.problem)
        return
      }

      // The importer has not read the page yet and can still fail, so it keeps
      // the Drop and keeps this screen underneath it. See the note at the top.
      if (chosen.id === 'recipe-import') {
        if (saveGroup !== group.slug) setGroup(saveGroup)
        router.push(result.href)
        return
      }

      haptics.itemSaved()
      // Follow the Drop into the Group it named, now that the write is done.
      if (saveGroup !== group.slug) setGroup(saveGroup)
      clear()
      router.dismissTo('/home')
      router.push(result.href)
    } catch {
      haptics.actionFailed()
      setProblem('failed')
    } finally {
      setSaving(false)
    }
  }

  function dismiss() {
    clear()
    router.dismissTo('/home')
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.title }} />
      {!drop ? (
        <View style={{ flex: 1, backgroundColor: tokens.bg }} />
      ) : (
        <ScrollView
          style={{ backgroundColor: tokens.bg }}
          contentContainerStyle={styles.content}
        >
          <DropPreview drop={drop} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fmt(text.savingTo, { group: named.name })}
            onPress={() => setNaming(true)}
            style={({ pressed }) => [
              styles.groupRow,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.groupText, { color: tokens.fg }]}>
              {fmt(text.savingTo, { group: named.name })}
            </Text>
            <Text style={[styles.change, { color: tokens.accent }]}>
              {text.changeGroup}
            </Text>
          </Pressable>

          <View style={styles.rows}>
            {targets.map((target) => (
              <TargetRow
                key={target.id}
                target={target}
                selected={target.id === chosen?.id}
                onPress={() => {
                  setSelected(target.id)
                  setProblem(null)
                  // A picker step moved, which is the one row in the haptics
                  // table that plays anything on an ordinary tap.
                  haptics.selectionChanged()
                }}
              />
            ))}
          </View>

          {problem ? (
            <Text style={[styles.problem, { color: tokens.danger }]}>
              {problem === 'failed' ? text.failed : text.problems[problem]}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={confirm}
            style={({ pressed }) => [
              styles.confirm,
              { backgroundColor: tokens.accent },
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={tokens.onAccent} />
            ) : (
              <Text style={[styles.confirmLabel, { color: tokens.onAccent }]}>
                {chosen && chosen.picks !== 'none'
                  ? text.continue
                  : text.confirm}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            hitSlop={12}
            style={styles.cancel}
          >
            <Text style={[styles.cancelLabel, { color: tokens.muted }]}>
              {text.cancel}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {naming ? (
        <DropGroupSheet
          selected={saveGroup}
          onSelect={setSaveGroup}
          onClose={() => setNaming(false)}
        />
      ) : null}
    </>
  )
}

/** What arrived, shown so nobody has to remember what they shared. */
function DropPreview({ drop }: { drop: Drop }) {
  const tokens = useTokens()
  const { t } = useI18n()
  const host = dropDisplayHost(drop)

  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: tokens.tile, borderColor: tokens.border },
      ]}
    >
      <Text style={[styles.previewKind, { color: tokens.muted }]}>
        {t.drop.kinds[drop.kind]}
      </Text>
      {drop.kind === 'image' ? (
        <Image
          source={{ uri: drop.uri }}
          style={styles.previewImage}
          contentFit="cover"
        />
      ) : (
        <>
          <Text
            style={[styles.previewTitle, { color: tokens.fg }]}
            numberOfLines={2}
          >
            {dropDisplayTitle(drop)}
          </Text>
          {host ? (
            <Text style={[styles.previewMeta, { color: tokens.muted }]}>
              {host}
            </Text>
          ) : null}
        </>
      )}
    </View>
  )
}

function TargetRow({
  target,
  selected,
  onPress,
}: {
  target: RankedDropTarget
  selected: boolean
  onPress: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const copy = t.drop.targets[target.id]
  const tint = tokens.tintOf(moduleById(target.module)?.group ?? 'home')
  const Icon = MODULE_ICONS[target.icon]
  const Check = UI_ICONS.Check

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={copy.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: tokens.surface,
          borderColor: selected ? tokens.accent : tokens.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint.bg }]}>
        <Icon size={20} color={tint.fg} strokeWidth={1.8} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tokens.fg }]}>
          {copy.label}
        </Text>
        <Text style={[styles.rowDetail, { color: tokens.muted }]}>
          {copy.detail}
        </Text>
      </View>
      {selected ? <Check size={18} color={tokens.accent} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  preview: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  previewKind: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  previewTitle: { fontSize: 16, fontWeight: '600' },
  previewMeta: { fontSize: 13 },
  previewImage: { width: '100%', height: 160, borderRadius: RADIUS.control },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupText: { fontSize: 15, flexShrink: 1 },
  change: { fontSize: 15, fontWeight: '600' },
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13 },
  pressed: { opacity: 0.75 },
  problem: { fontSize: 14, lineHeight: 20 },
  confirm: {
    borderRadius: RADIUS.control,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: { fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 6 },
  cancelLabel: { fontSize: 15 },
})
