/**
 * One subject: its facts, its photo, and the household's history with it.
 *
 * ## One screen, two chromes, decided by content
 *
 * A subject **with a photo** is a Detail screen (`docs/mobile-interaction.md`):
 * no title in the bar, the photo and the name pinned, only the tastings
 * scrolling. You recognise this record by its picture, which is the whole
 * test. The same subject **without** one is Pushed: title in the bar,
 * everything scrolls, and the empty photo tile sits in the body as an ordinary
 * invitation.
 *
 * That is the one place this design branches on content rather than on Kind,
 * and it is worth saying out loud because everything else here is Kind-blind —
 * the facts grid is whatever `subjectFields` declares, rendered by the same
 * five components the composer uses.
 *
 * ## Attribution is on the row, not behind a tap
 *
 * Every tasting shows who, when, the descriptors and the scales as pips. Two
 * Members of one wine club genuinely disagree, and a page that averaged them
 * into a single number would be hiding the interesting part.
 *
 * ## Holding a row draws the permission rule
 *
 * Your own tasting offers Edit and Delete; somebody else's offers Delete only.
 * Nobody edits words that appear under another person's name; anybody tidies
 * (stories 18 and 19). A menu is never the only way to reach either — Edit is
 * also the composer's own screen, and Delete is on it too.
 *
 * The `⋯` in the header is the subject's menu, and its Delete opens an alert
 * naming how many tastings go with it (story 22). gather deletes permanently —
 * no archive, no undo — so this is the confirm side of confirm-or-undo, never
 * both.
 */
import type { TastingAttributeValue, TastingKind } from '@gather/core/tastings'
import { tastingFields } from '@gather/core/tastings'
import { useMutation, useQuery } from 'convex/react'
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { pickPhoto, uploadPhoto } from '../../photo/pickPhoto'
import { useRecordRecent } from '../../search/recentRecords'
import { RADIUS, useTokens } from '../../theme/tokens'
import { TASTING_UI_ICONS } from './icons'
import type { TastingBase } from './paths'
import { tastingHref } from './paths'
import { StarRating } from './StarRating'
import { subjectFacts } from './summary'
import { tastingFieldText } from './TastingField'
import { fieldLabel, kindWords, term } from './words'

export function SubjectScreen({
  base,
  kind,
  subjectId,
}: {
  base: TastingBase
  kind: TastingKind
  subjectId: string
}) {
  const tokens = useTokens('tasting')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()

  const removeSubject = useMutation(api.tastings.removeSubject)
  const removeTasting = useMutation(api.tastings.removeTasting)
  const updateSubject = useMutation(api.tastings.updateSubject)
  const generateUploadUrl = useMutation(api.tastings.generateUploadUrl)

  const [menuOpen, setMenuOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoProblem, setPhotoProblem] = useState<string | null>(null)

  const page = useQuery(api.tastings.getSubject, {
    groupSlug: group.slug,
    id: subjectId as Id<'tastingSubjects'>,
    kind,
  })

  useRecordRecent(
    page && page !== null
      ? {
          id: page.subject._id,
          type: 'tasting',
          title: page.subject.name,
          detail: page.subject.kind,
        }
      : null,
  )

  const words = kindWords(t.tastings, kind)
  const copy = t.tastings.subject
  const Ellipsis = TASTING_UI_ICONS.Ellipsis
  const Plus = TASTING_UI_ICONS.Plus
  const PhotoIcon = TASTING_UI_ICONS.ImagePlus
  const tint = tokens.tintOf('tasting')

  if (page === undefined) {
    return (
      <View style={[styles.centre, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.muted} />
      </View>
    )
  }

  if (page === null) {
    // Deleted from another device while this was open, or a stale deep link.
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: words.many }} />
        <View style={[styles.centre, { backgroundColor: tokens.bg }]}>
          <Text style={{ color: tokens.muted }}>{copy.noTastings}</Text>
        </View>
      </>
    )
  }

  const { subject, tastings } = page
  const detail = subject.photoUrl !== null

  function compose(mode: 'new' | 'subject' | 'tasting', tastingId?: string) {
    router.push(
      tastingHref(base, kind, '/compose', {
        mode,
        subjectId: subject._id,
        ...(tastingId ? { tastingId } : {}),
      }),
    )
  }

  function confirmSubjectDelete() {
    Alert.alert(
      fmt(copy.deleteSubjectTitle, { name: subject.name }),
      subject.count === 0
        ? copy.deleteSubjectBodyEmpty
        : plural(locale, subject.count, copy.deleteSubjectBody),
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: copy.delete,
          style: 'destructive',
          onPress: async () => {
            await removeSubject({
              groupSlug: group.slug,
              id: subject._id as Id<'tastingSubjects'>,
            })
            haptics.itemCompleted()
            router.back()
          },
        },
      ],
    )
  }

  function confirmTastingDelete(tastingId: string) {
    Alert.alert(copy.deleteTastingTitle, copy.deleteTastingBody, [
      { text: t.actions.cancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: async () => {
          await removeTasting({
            groupSlug: group.slug,
            id: tastingId as Id<'tastings'>,
          })
          haptics.itemCompleted()
        },
      },
    ])
  }

  /**
   * The label, prepared before it leaves the phone (ADR-0010) and uploaded
   * before the patch, so a save whose upload failed never changed the row.
   * `recipePhoto` rather than a fourth preset: a bottle's label is the same
   * job as a recipe's hero, and `PHOTO_PRESETS` is the one place a dimension
   * may be written down.
   */
  async function addPhoto() {
    setPhotoProblem(null)
    const picked = await pickPhoto('library', 'recipePhoto').catch(
      () => 'failed' as const,
    )
    if (picked === null) return
    if (picked === 'denied') {
      setPhotoProblem(copy.photoDenied)
      return
    }
    if (picked === 'failed') {
      setPhotoProblem(copy.photoFailed)
      return
    }
    setUploading(true)
    try {
      const storageId = await uploadPhoto(picked.uri, await generateUploadUrl())
      await updateSubject({
        groupSlug: group.slug,
        id: subject._id as Id<'tastingSubjects'>,
        name: subject.name,
        attributes: subject.attributes,
        photoId: storageId as Id<'_storage'>,
      })
      haptics.itemSaved()
    } catch {
      setPhotoProblem(copy.photoFailed)
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto() {
    await updateSubject({
      groupSlug: group.slug,
      id: subject._id as Id<'tastingSubjects'>,
      name: subject.name,
      attributes: subject.attributes,
      photoId: null,
    })
  }

  /**
   * The subject's own actions.
   *
   * A sheet rather than the hold-menu every *row* gets, and that is a platform
   * constraint rather than a preference: `@expo/ui`'s `MenuView` does not
   * survive being rendered into a native header slot — the header subview is
   * outside the tree it needs — so a `⋯` that opened one simply did nothing.
   * The platform's own sheet works in both places and keeps the rule that
   * matters: every action here is also reachable somewhere else (Edit is the
   * composer's own screen, the photo tile is in the body).
   */
  const subjectActions: { id: string; label: string; danger?: boolean }[] = [
    { id: 'edit', label: copy.editSubject },
    subject.photoUrl
      ? { id: 'replacePhoto', label: copy.replacePhoto }
      : { id: 'addPhoto', label: copy.takePhoto },
    ...(subject.photoUrl
      ? [{ id: 'removePhoto', label: copy.removePhoto }]
      : []),
    { id: 'delete', label: copy.delete, danger: true },
  ]

  function onSubjectMenu(id: string) {
    setMenuOpen(false)
    if (id === 'edit') compose('subject')
    if (id === 'addPhoto' || id === 'replacePhoto') addPhoto()
    if (id === 'removePhoto') removePhoto()
    if (id === 'delete') confirmSubjectDelete()
  }

  const headerRight = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subject.name}
      onPress={() => setMenuOpen(true)}
      hitSlop={12}
      style={({ pressed }) => [styles.overflow, pressed && styles.pressed]}
    >
      <Ellipsis size={22} color={tint.fg} strokeWidth={2} />
    </Pressable>
  )

  const menu = menuOpen ? (
    <NativeSheet title={subject.name} onClose={() => setMenuOpen(false)}>
      {subjectActions.map((action) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => onSubjectMenu(action.id)}
          style={({ pressed }) => [
            styles.menuRow,
            { borderBottomColor: tokens.border },
            pressed && { backgroundColor: tokens.tile },
          ]}
        >
          <Text
            style={[
              styles.menuLabel,
              { color: action.danger ? tokens.danger : tokens.fg },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </NativeSheet>
  ) : null

  const facts = tastingFields(kind, 'subject')
    .map((field) => ({
      field,
      text: tastingFieldText(
        t.tastings,
        field,
        subject.attributes[field.key] as TastingAttributeValue | undefined,
      ),
    }))
    .filter((entry) => entry.text !== null)

  const logButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.logTasting}
      onPress={() => compose('new')}
      style={({ pressed }) => [
        styles.logButton,
        { backgroundColor: tint.fg },
        pressed && styles.pressed,
      ]}
    >
      <Plus size={16} color={tokens.surface} strokeWidth={2.4} />
      <Text style={[styles.logButtonText, { color: tokens.surface }]}>
        {copy.logTasting}
      </Text>
    </Pressable>
  )

  const body = (
    <>
      {/* Pushed only: the photo tile is an ordinary invitation in the body,
        because there is no pinned region for it to live in. */}
      {!detail ? (
        <View style={styles.pushedHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.takePhoto}
            disabled={uploading}
            onPress={addPhoto}
            style={({ pressed }) => [
              styles.photoTile,
              { backgroundColor: tokens.tile, borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={tokens.muted} />
            ) : (
              <>
                <PhotoIcon size={20} color={tokens.muted} strokeWidth={1.8} />
                <Text style={[styles.photoLabel, { color: tokens.muted }]}>
                  {copy.addPhoto}
                </Text>
              </>
            )}
          </Pressable>
          <View style={styles.pushedMeta}>
            <StarRating
              value={subject.average}
              size={18}
              count={subject.count}
            />
            {logButton}
          </View>
        </View>
      ) : null}

      {photoProblem ? (
        <Text style={[styles.problem, { color: tokens.danger }]}>
          {photoProblem}
        </Text>
      ) : null}

      {facts.length > 0 ? (
        <View style={[styles.facts, { borderColor: tokens.border }]}>
          {facts.map(({ field, text }) => (
            <View
              key={field.key}
              style={[styles.fact, { backgroundColor: tokens.surface }]}
            >
              <Text style={[styles.factLabel, { color: tokens.muted }]}>
                {fieldLabel(t.tastings, field).toUpperCase()}
              </Text>
              <Text style={[styles.factValue, { color: tokens.fg }]}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[styles.heading, { color: tokens.muted }]}>
        {copy.tastings.toUpperCase()}
      </Text>

      {tastings.length === 0 ? (
        <Text style={[styles.problem, { color: tokens.muted }]}>
          {copy.noTastings}
        </Text>
      ) : null}

      {tastings.map((tasting) => {
        const scales = tastingFields(kind, 'tasting').filter(
          (field) =>
            field.type === 'scale' &&
            typeof tasting.attributes[field.key] === 'number',
        )
        const tags = tastingFields(kind, 'tasting').flatMap((field) => {
          const value = tasting.attributes[field.key]
          return field.type === 'tags' && Array.isArray(value)
            ? value.map((key) => ({
                key: `${field.key}:${key}`,
                label: term(t.tastings, field.vocabulary, key),
              }))
            : []
        })
        const notes = tasting.attributes.notes
        const menu = [
          ...(tasting.mine ? [{ id: 'edit', title: copy.edit }] : []),
          {
            id: 'delete',
            title: copy.delete,
            attributes: { destructive: true },
          },
        ]

        return (
          <NativeContextMenu
            key={tasting._id}
            actions={menu}
            onAction={(id) => {
              if (id === 'edit') compose('tasting', tasting._id)
              if (id === 'delete') confirmTastingDelete(tasting._id)
            }}
          >
            <View
              style={[styles.tasting, { borderBottomColor: tokens.border }]}
            >
              <View style={styles.tastingHead}>
                <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.initial, { color: tint.fg }]}>
                    {(tasting.mine ? copy.you : (tasting.byName ?? '?'))
                      .slice(0, 1)
                      .toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.who, { color: tokens.fg }]}>
                  {tasting.mine ? copy.you : (tasting.byName ?? '')}
                </Text>
                <Text style={[styles.when, { color: tokens.muted }]}>
                  {new Date(`${tasting.tastedAt}T00:00:00Z`).toLocaleDateString(
                    locale,
                    { day: 'numeric', month: 'short', timeZone: 'UTC' },
                  )}
                </Text>
                <View style={styles.spacer} />
                <Text style={[styles.score, { color: tint.fg }]}>
                  {tasting.rating.toFixed(1)}
                </Text>
              </View>

              {tags.length > 0 ? (
                <View style={styles.tags}>
                  {tags.map((tag) => (
                    <View
                      key={tag.key}
                      style={[styles.tag, { backgroundColor: tint.bg }]}
                    >
                      <Text style={[styles.tagText, { color: tint.fg }]}>
                        {tag.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {scales.length > 0 ? (
                <View style={styles.scales}>
                  {scales.map((field) => (
                    <View key={field.key} style={styles.scale}>
                      <Text
                        style={[styles.scaleLabel, { color: tokens.muted }]}
                      >
                        {fieldLabel(t.tastings, field)}
                      </Text>
                      <View style={styles.pips}>
                        {[1, 2, 3, 4, 5].map((step) => (
                          <View
                            key={step}
                            style={[
                              styles.pip,
                              {
                                backgroundColor:
                                  step <=
                                  (tasting.attributes[field.key] as number)
                                    ? tint.fg
                                    : tokens.border,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {typeof notes === 'string' && notes ? (
                <Text style={[styles.notes, { color: tokens.fg }]}>
                  {notes}
                </Text>
              ) : null}
            </View>
          </NativeContextMenu>
        )
      })}
    </>
  )

  if (!detail) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: subject.name, headerRight }}
        />
        <ScrollView
          style={{ backgroundColor: tokens.bg }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {body}
        </ScrollView>
        {menu}
      </>
    )
  }

  /**
   * Detail: a fixed region, not a collapse. The photo and the name are laid
   * out as ordinary pinned views above a `ScrollView` that holds only the
   * body, so none of the Index screen's scroll-linked machinery applies. The
   * `title` is still set even though nothing draws it — it is the only thing
   * VoiceOver and the app switcher have to name the screen with.
   */
  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: subject.name, headerRight }}
      />
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        <Image
          source={{ uri: subject.photoUrl ?? undefined }}
          style={styles.hero}
          contentFit="cover"
          accessibilityLabel={fmt(copy.photoOf, { name: subject.name })}
          accessibilityIgnoresInvertColors
        />
        <View style={[styles.pinned, { borderBottomColor: tokens.border }]}>
          <Text
            accessibilityRole="header"
            style={[styles.pinnedName, { color: tokens.fg }]}
          >
            {subject.name}
          </Text>
          <Text style={[styles.pinnedFacts, { color: tokens.muted }]}>
            {subjectFacts(t.tastings, kind, subject.attributes)}
          </Text>
          <View style={styles.pinnedMeta}>
            <StarRating
              value={subject.average}
              size={18}
              count={subject.count}
            />
            <View style={styles.spacer} />
            {logButton}
          </View>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {body}
        </ScrollView>
      </View>
      {menu}
    </>
  )
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // 44pt, because the glyph is 22 and a header control is still a touch target.
  overflow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    justifyContent: 'center',
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { fontSize: 16 },
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  hero: { width: '100%', height: 200 },
  pinned: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.7 },
  pinnedFacts: { fontSize: 13.5 },
  pinnedMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pushedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pushedMeta: { flex: 1, gap: 8 },
  photoTile: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  photoLabel: { fontSize: 11 },
  problem: { fontSize: 13 },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: RADIUS.control,
  },
  logButtonText: { fontSize: 15, fontWeight: '700' },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fact: { width: '50%', gap: 2, padding: 11 },
  factLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 },
  factValue: { fontSize: 15 },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  tasting: {
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tastingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 11.5, fontWeight: '700' },
  who: { fontSize: 15, fontWeight: '600' },
  when: { fontSize: 13 },
  spacer: { flex: 1 },
  score: { fontSize: 16, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tagText: { fontSize: 12.5 },
  scales: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scaleLabel: { fontSize: 12 },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 11, height: 5, borderRadius: 3 },
  notes: { fontSize: 13.5, lineHeight: 19 },
  pressed: { opacity: 0.6 },
})
