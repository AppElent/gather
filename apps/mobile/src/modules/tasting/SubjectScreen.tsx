/**
 * One subject: its facts, its photo, and the household's history with it.
 *
 * ## One screen, two chromes, decided by content
 *
 * A subject **with a photo** opens on it (`PhotoHeader`): the photo full-bleed
 * under the transparent bar, the Module's eyebrow and the name, then a
 * `FactsStrip` of the average and how many tastings it rests on. The native
 * inline title appears once the name has scrolled under the bar. You
 * recognise this record by its picture, which is the whole test. The same
 * subject **without** one opens on the group's wash under the native large
 * title (`WashHeader`) — never a placeholder picture; adding a photo is in the
 * `⋯` menu.
 *
 * That is the one place this design branches on content rather than on Kind,
 * and it is worth saying out loud because everything else here is Kind-blind —
 * the facts grid is whatever `subjectFields` declares, read out by
 * `tastingFieldText` from the same field defs the composer draws.
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
import { localMidnight } from '@gather/core/civil-date'
import type { TastingAttributeValue, TastingKind } from '@gather/core/tastings'
import { tastingFields } from '@gather/core/tastings'
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { pickPhoto, uploadPhoto } from '../../photo/pickPhoto'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { FactsStrip } from '../../ui/facts-strip'
import { moduleTile } from '../../ui/module-tile'
import { PhotoHeader, usePhotoTitle } from '../../ui/photo-header'
import {
  pendingScreenOptions,
  photoScreenOptions,
  washScreenOptions,
} from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { KIND_ICONS, TASTING_UI_ICONS } from './icons'
import { moduleIdOf } from './paths'
import { StarRating } from './StarRating'
import { subjectFacts, tastingCount } from './summary'
import { tastingFieldText } from './TastingField'
import { fieldLabel, kindWords, term } from './words'

export function SubjectScreen({
  kind,
  subjectId,
}: {
  kind: TastingKind
  subjectId: string
}) {
  const tokens = useTokens('tasting')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const photoTitle = usePhotoTitle()

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
          detail: t.search.kinds[kind],
          kind,
        }
      : null,
  )

  const words = kindWords(t.tastings, kind)
  const copy = t.tastings.subject
  const Ellipsis = TASTING_UI_ICONS.Ellipsis
  const Plus = TASTING_UI_ICONS.Plus
  const moduleId = moduleIdOf(kind)
  const tile = moduleTile(moduleId) ?? {
    group: 'tasting' as const,
    glyph: KIND_ICONS[kind],
  }
  const moduleLabel =
    (t.modules.byId as Record<string, { label: string }>)[moduleId]?.label ??
    words.many

  if (page === undefined) {
    return (
      <>
        <Stack.Screen options={pendingScreenOptions(moduleLabel)} />
        <View style={[styles.centre, { backgroundColor: tokens.ground }]}>
          <ActivityIndicator color={tokens.muted} />
        </View>
      </>
    )
  }

  if (page === null) {
    // Deleted from another device while this was open, or a stale deep link.
    return (
      <>
        <Stack.Screen options={pendingScreenOptions(words.many)} />
        <View style={[styles.centre, { backgroundColor: tokens.ground }]}>
          <Text style={{ color: tokens.muted }}>{copy.noTastings}</Text>
        </View>
      </>
    )
  }

  const { subject, tastings } = page
  const detail = subject.photoUrl !== null

  function compose(mode: 'new' | 'subject' | 'tasting', tastingId?: string) {
    router.push(
      moduleHref(`/all/tasting/${kind}/compose`, {
        mode,
        subjectId: subject._id,
        ...(tastingId ? { tastingId } : {}),
      }),
    )
  }

  function confirmSubjectDelete() {
    confirmDestructive({
      title: fmt(copy.deleteSubjectTitle, { name: subject.name }),
      message:
        subject.count === 0
          ? copy.deleteSubjectBodyEmpty
          : plural(locale, subject.count, copy.deleteSubjectBody),
      confirm: copy.delete,
      cancel: t.common.actions.cancel,
      onConfirm: async () => {
        await removeSubject({
          groupSlug: group.slug,
          id: subject._id as Id<'tastingSubjects'>,
        })
        haptics.itemCompleted()
        router.back()
      },
    })
  }

  function confirmTastingDelete(tastingId: string) {
    confirmDestructive({
      title: copy.deleteTastingTitle,
      message: copy.deleteTastingBody,
      confirm: copy.delete,
      cancel: t.common.actions.cancel,
      onConfirm: async () => {
        await removeTasting({
          groupSlug: group.slug,
          id: tastingId as Id<'tastings'>,
        })
        haptics.itemCompleted()
      },
    })
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
      <Ellipsis size={22} color={tokens.accentText} strokeWidth={2} />
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
            { borderBottomColor: tokens.hair },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <Text
            style={[
              styles.menuLabel,
              { color: action.danger ? tokens.danger : tokens.ink },
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
        { backgroundColor: tokens.accent },
        pressed && styles.pressed,
      ]}
    >
      <Plus size={16} color={tokens.onAccent} strokeWidth={2.4} />
      <Text style={[styles.logButtonText, { color: tokens.onAccent }]}>
        {copy.logTasting}
      </Text>
    </Pressable>
  )

  const body = (
    <>
      <View style={styles.meta}>
        {detail ? null : (
          <StarRating value={subject.average} size={18} count={subject.count} />
        )}
        <View style={styles.spacer} />
        {uploading ? <ActivityIndicator color={tokens.muted} /> : null}
        {logButton}
      </View>

      {photoProblem ? (
        <Text style={[styles.problem, { color: tokens.danger }]}>
          {photoProblem}
        </Text>
      ) : null}

      {facts.length > 0 ? (
        <View style={[styles.facts, { borderColor: tokens.hair }]}>
          {facts.map(({ field, text }) => (
            <View
              key={field.key}
              style={[styles.fact, { backgroundColor: tokens.surface }]}
            >
              <Text style={[styles.factLabel, { color: tokens.muted }]}>
                {fieldLabel(t.tastings, field)}
              </Text>
              <Text style={[styles.factValue, { color: tokens.ink }]}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <SectionLabel>{copy.tastings}</SectionLabel>

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
            <View style={[styles.tasting, { borderBottomColor: tokens.hair }]}>
              <View style={styles.tastingHead}>
                <View
                  style={[styles.avatar, { backgroundColor: tokens.surface2 }]}
                >
                  <Text style={[styles.initial, { color: tokens.ink }]}>
                    {(tasting.mine ? copy.you : (tasting.byName ?? '?'))
                      .slice(0, 1)
                      .toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.who, { color: tokens.ink }]}>
                  {tasting.mine ? copy.you : (tasting.byName ?? '')}
                </Text>
                <Text style={[styles.when, { color: tokens.muted }]}>
                  {localMidnight(tasting.tastedAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <View style={styles.spacer} />
                <Text style={[styles.score, { color: tokens.ink }]}>
                  {tasting.rating.toFixed(1)}
                </Text>
              </View>

              {tags.length > 0 ? (
                <View style={styles.tags}>
                  {tags.map((tag) => (
                    <View
                      key={tag.key}
                      style={[styles.tag, { backgroundColor: tokens.surface2 }]}
                    >
                      <Text style={[styles.tagText, { color: tokens.ink }]}>
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
                                    ? tokens.ink
                                    : tokens.hair,
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
                <Text style={[styles.notes, { color: tokens.ink }]}>
                  {notes}
                </Text>
              ) : null}
            </View>
          </NativeContextMenu>
        )
      })}
    </>
  )

  const factsLine = subjectFacts(t.tastings, kind, subject.attributes)

  if (!detail) {
    return (
      <>
        <Stack.Screen
          options={{ ...washScreenOptions(subject.name), headerRight }}
        />
        <ScrollView
          // Without it the body starts under the large title and draws over it.
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.ground }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: tastingCount(t, locale, subject.count),
              scope: factsLine || undefined,
            }}
          />
          <View style={styles.content}>{body}</View>
        </ScrollView>
        {menu}
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...photoScreenOptions(
            subject.name,
            photoTitle.shown,
            tokens.ink,
            photoTitle.laidOut,
          ),
          headerRight,
        }}
      />
      <ScrollView
        // The photo starts under the status bar and the transparent bar.
        contentInsetAdjustmentBehavior="automatic"
        onScroll={photoTitle.onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <PhotoHeader
          photo={{
            uri: subject.photoUrl ?? '',
            alt: fmt(copy.photoOf, { name: subject.name }),
          }}
          group={tile.group}
          glyph={tile.glyph}
          eyebrow={moduleLabel}
          title={subject.name}
          onTitleBottom={photoTitle.onTitleBottom}
        />
        <View style={styles.content}>
          {factsLine ? (
            <Text style={[styles.factsLine, { color: tokens.muted }]}>
              {factsLine}
            </Text>
          ) : null}
          <FactsStrip
            facts={[
              subject.average === null
                ? null
                : {
                    value: subject.average.toFixed(1),
                    unit: copy.factUnits.average,
                  },
              subject.count > 0
                ? {
                    value: String(subject.count),
                    unit: plural(
                      locale,
                      subject.count,
                      copy.factUnits.tastings,
                    ),
                  }
                : null,
            ]}
          />
          {body}
        </View>
      </ScrollView>
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
  menuLabel: { ...TYPE.body },
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: 14 },
  factsLine: { ...TYPE.footnote },
  // Wraps: at 17 pt (and larger Dynamic Type) the button no longer fits
  // beside the stars on a narrow phone, so it drops to its own line.
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  problem: { ...TYPE.footnote },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: RADIUS.pill,
  },
  logButtonText: { ...TYPE.bodyStrong },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fact: { width: '50%', gap: 2, padding: 11 },
  factLabel: { ...TYPE.footnoteStrong },
  factValue: { ...TYPE.subhead },
  tasting: {
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tastingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // A coin that grows with its initial rather than clipping it.
  avatar: {
    minWidth: 24,
    minHeight: 24,
    paddingHorizontal: 4,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { ...TYPE.footnoteStrong },
  who: { ...TYPE.bodyStrong },
  when: { ...TYPE.footnote },
  spacer: { flex: 1 },
  score: { ...TYPE.bodyStrong, ...TABULAR },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
  },
  tagText: { ...TYPE.footnote },
  scales: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scaleLabel: { ...TYPE.footnote },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 11, height: 5, borderRadius: 3 },
  notes: { ...TYPE.footnote },
  pressed: { opacity: 0.6 },
})
