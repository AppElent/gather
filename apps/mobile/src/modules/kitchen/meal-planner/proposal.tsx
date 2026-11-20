/**
 * Plan mijn week's proposal in the week (designs/meal-planner §3, direction
 * A): the status card under the header, one dashed draft card per proposed
 * slot inside its day, and the bar at the bottom that accepts or discards
 * them all.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { MealThumb } from './parts'
import { PrimaryButton } from './plan-sheet'
import { weekdayName } from './week'
import { type Draft, draftReason } from './week-plan'

/** "Voorstel van Gather", or "Eenvoudig voorstel" when the rules made it. */
export function ProposalCard({ fallback }: { fallback: boolean }) {
  const { t } = useI18n()
  const words = t.mealPlanner.proposal
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const Icon = fallback ? UI_ICONS.Clock : UI_ICONS.Spark
  return (
    <View
      accessibilityRole="summary"
      testID={fallback ? 'proposal-fallback' : 'proposal-ai'}
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <View style={[styles.tile, { backgroundColor: tint.wash }]}>
        <Icon size={16} color={tint.text} strokeWidth={2} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: tokens.ink }]}>
          {fallback ? words.fallbackTitle : words.aiTitle}
        </Text>
        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {fallback ? words.fallbackBody : words.aiBody}
        </Text>
      </View>
    </View>
  )
}

/** One proposed slot: what, why, and Neem over · Iets anders · regenerate. */
export function DraftCard({
  draft,
  regenerating,
  onAccept,
  onSomethingElse,
  onRegenerate,
}: {
  draft: Draft
  regenerating: boolean
  onAccept: () => void
  onSomethingElse: () => void
  onRegenerate: () => void
}) {
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const proposal = words.proposal
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const day = weekdayName(draft.date, locale).toLocaleLowerCase(locale)
  const reason = draftReason(draft, words)
  return (
    <View
      testID={`draft-${draft.date}-${draft.slot}`}
      style={[styles.draft, { borderColor: tint.text }]}
    >
      <View
        accessible
        accessibilityLabel={`${fmt(proposal.eyebrow, { slot: words.slots[draft.slot] })}, ${draft.title}, ${reason}`}
        style={styles.draftHead}
      >
        <MealThumb imageUrl={draft.imageUrl} quick={!draft.recipeId} />
        <View style={styles.draftText}>
          <View style={styles.eyebrow}>
            <UI_ICONS.Spark size={12} color={tint.text} strokeWidth={2.4} />
            <Text style={[styles.eyebrowText, { color: tint.text }]}>
              {fmt(proposal.eyebrow, { slot: words.slots[draft.slot] })}
            </Text>
          </View>
          <Text style={[styles.title, { color: tokens.ink }]}>{draft.title}</Text>
          <Text style={[styles.footnote, { color: tokens.muted }]}>{reason}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <View style={styles.acceptWrap}>
          <PrimaryButton
            label={proposal.accept}
            accessibilityLabel={fmt(proposal.acceptLabel, { title: draft.title, day })}
            testID={`draft-accept-${draft.date}-${draft.slot}`}
            onPress={onAccept}
            grow
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fmt(proposal.somethingElseLabel, { day })}
          testID={`draft-else-${draft.date}-${draft.slot}`}
          onPress={onSomethingElse}
          style={({ pressed }) => [
            styles.secondary,
            { backgroundColor: tokens.surface2 },
            pressed && styles.pressed,
          ]}
        >
          <Text maxFontSizeMultiplier={2} style={[styles.secondaryLabel, { color: tokens.ink }]}>
            {proposal.somethingElse}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fmt(proposal.regenerate, { day })}
          accessibilityState={{ busy: regenerating, disabled: regenerating }}
          testID={`draft-regenerate-${draft.date}-${draft.slot}`}
          disabled={regenerating}
          onPress={onRegenerate}
          style={({ pressed }) => [
            styles.round,
            { backgroundColor: tokens.surface2 },
            (pressed || regenerating) && styles.pressed,
          ]}
        >
          <UI_ICONS.Regenerate size={18} color={tokens.ink} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  )
}

/**
 * The bar over the bottom of the week: "{n} voorstellen nog niet bewaard"
 * with Weggooien and Neem alle over, or, once none are left, "Alles staat in
 * het weekmenu" with the week's groceries and Klaar.
 */
export function ProposalBar({
  pending,
  bottom,
  onDiscard,
  onAcceptAll,
  onGroceries,
  onDone,
  busy,
}: {
  pending: number
  bottom: number
  onDiscard: () => void
  onAcceptAll: () => void
  onGroceries: () => void
  onDone: () => void
  busy: boolean
}) {
  const { t, locale } = useI18n()
  const words = t.mealPlanner.proposal
  const tokens = useTokens('kitchen')
  return (
    <View
      testID="proposal-bar"
      style={[
        styles.bar,
        { bottom, backgroundColor: tokens.surface, shadowColor: tokens.ink },
      ]}
    >
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.status, { color: tokens.ink }]}
      >
        {pending > 0 ? plural(locale, pending, words.pending) : words.allSaved}
      </Text>
      {pending > 0 ? (
        <View style={styles.barButtons}>
          <Pressable
            accessibilityRole="button"
            testID="proposal-discard"
            disabled={busy}
            onPress={onDiscard}
            style={({ pressed }) => [
              styles.barSecondary,
              { backgroundColor: tokens.surface2 },
              pressed && styles.pressed,
            ]}
          >
            <Text maxFontSizeMultiplier={2} style={[styles.body, { color: tokens.ink }]}>
              {words.discard}
            </Text>
          </Pressable>
          <View style={styles.acceptWrap}>
            <PrimaryButton
              label={plural(locale, pending, words.acceptAll)}
              testID="proposal-accept-all"
              onPress={onAcceptAll}
              busy={busy}
              minHeight={48}
              grow
            />
          </View>
        </View>
      ) : (
        <View style={styles.barButtons}>
          <View style={styles.acceptWrap}>
            <Pressable
              accessibilityRole="button"
              testID="proposal-groceries"
              onPress={onGroceries}
              style={({ pressed }) => [
                styles.barPrimary,
                { backgroundColor: tokens.accent },
                pressed && styles.pressed,
              ]}
            >
              <UI_ICONS.Cart size={18} color={tokens.onAccent} strokeWidth={2.2} />
              <Text
                maxFontSizeMultiplier={2}
                numberOfLines={2}
                style={[styles.barPrimaryLabel, { color: tokens.onAccent }]}
              >
                {words.groceries}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            testID="proposal-done"
            onPress={onDone}
            style={({ pressed }) => [
              styles.barSecondary,
              { backgroundColor: tokens.surface2 },
              pressed && styles.pressed,
            ]}
          >
            <Text maxFontSizeMultiplier={2} style={[styles.body, { color: tokens.ink }]}>
              {words.done}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingHorizontal: SPACE[4],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE[3],
  },
  tile: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.tileS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...TYPE.subhead, fontWeight: '600' },
  footnote: { ...TYPE.footnote },
  draft: {
    margin: SPACE[2],
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: SPACE[3],
    gap: 10,
  },
  draftHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE[3] },
  draftText: { flex: 1, minWidth: 0 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  eyebrowText: { ...TYPE.footnoteStrong },
  title: { ...TYPE.bodyStrong },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  acceptWrap: { flexGrow: 1, flexShrink: 1 },
  secondary: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  secondaryLabel: { ...TYPE.subhead, fontWeight: '600' },
  round: {
    width: SIZE.hitMin,
    height: SIZE.hitMin,
    borderRadius: SIZE.hitMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: SPACE[3],
    right: SPACE[3],
    borderRadius: 28,
    borderCurve: 'continuous',
    padding: 10,
    gap: SPACE[2],
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  status: { ...TYPE.footnote, textAlign: 'center' },
  barButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  barSecondary: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  barPrimary: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
    paddingHorizontal: SPACE[4],
  },
  barPrimaryLabel: { ...TYPE.bodyStrong, flexShrink: 1, textAlign: 'center' },
  body: { ...TYPE.body },
  pressed: { opacity: 0.7 },
})
