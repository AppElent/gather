/**
 * One recipe, whole, and the screen you actually cook from.
 *
 * Everything on one scroll: the picture, the description, who added it, where
 * it came from, its nutrition, its ingredients and its steps. No tabs and no
 * stepper — a cook with wet hands wants to look, not to navigate — and no
 * paging, because a recipe is short enough to be one page.
 *
 * ## The screen stays lit
 *
 * `useKeepAwake` holds the display on for as long as this screen is mounted,
 * and releases it on the way out. It is the one piece of a "cook mode" that
 * ships here: a phone that goes dark at the moment both hands are covered in
 * flour is the single most annoying thing about cooking from one. Leaving the
 * recipe releases the lock, so a recipe left open in a pocket does not flatten
 * the battery.
 *
 * ## Rating is a tap, and it is optimistic
 *
 * Small, frequent, reversible — the three conditions
 * `docs/mobile-interaction.md` sets for an optimistic write. The star fills
 * immediately, and if the mutation is refused Convex rolls the local store back
 * and the star empties again. That rollback has to be *visible*, which is why
 * there is a failure haptic and a line of text beside it rather than a silent
 * revert somebody would read as a missed tap.
 *
 * ## A recipe you may only read says so
 *
 * `canEdit` is false for a recipe reached through a Share. The stars go inert,
 * Edit and Delete are not drawn, and a line names the Group it lives in — so
 * the absence of the controls has a reason rather than looking like a bug
 * (ADR-0009's sibling: never offer an action that can only fail).
 */
import { useAction, useMutation, useQuery } from 'convex/react'
import { Image } from 'expo-image'
import { useKeepAwake } from 'expo-keep-awake'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { openBrowserAsync } from 'expo-web-browser'
import { useState } from 'react'
import {
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
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { RECIPE_UI_ICONS } from './icons'
import { NutritionFacts } from './NutritionFacts'
import { type RecipeBase, recipeHref } from './paths'
import { StarRating } from './StarRating'
import { useRecipes } from './useRecipes'

export interface RecipeScreenProps {
  /** Which tab stack this instance is mounted in (ADR-0023). */
  base: RecipeBase
}

export function RecipeScreen({ base }: RecipeScreenProps) {
  useKeepAwake()

  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { groupSlug } = useRecipes()
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>()

  const recipe = useQuery(
    api.recipes.get,
    recipeId ? { id: recipeId as Id<'recipes'>, groupSlug } : 'skip',
  )
  const remove = useMutation(api.recipes.remove)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const setNutrition = useMutation(api.recipes.setNutrition)

  /**
   * The rating, applied locally the instant it is tapped.
   *
   * The optimistic update patches the *same query this screen reads*, so the
   * star fills without a round trip; a rejected write makes Convex drop the
   * patch and the previous value reappears on its own.
   */
  const rate = useMutation(api.recipes.rate).withOptimisticUpdate(
    (store, { id, rating }) => {
      const current = store.getQuery(api.recipes.get, { id, groupSlug })
      if (current)
        store.setQuery(
          api.recipes.get,
          { id, groupSlug },
          { ...current, rating: rating ?? undefined },
        )
      const listed = store.getQuery(api.recipes.list, { groupSlug })
      if (listed)
        store.setQuery(
          api.recipes.list,
          { groupSlug },
          listed.map((row) =>
            row._id === id ? { ...row, rating: rating ?? undefined } : row,
          ),
        )
    },
  )

  const [problem, setProblem] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)

  const text = t.recipes

  if (recipe === undefined)
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: t.modules.byId.recipes.label }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        </View>
      </>
    )

  if (recipe === null)
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: t.modules.byId.recipes.label }}
        />
        <View style={[styles.fill, { backgroundColor: tokens.bg }]}>
          <Text
            testID="recipe-not-found"
            style={[styles.missing, { color: tokens.muted }]}
          >
            {text.detail.notFound}
          </Text>
        </View>
      </>
    )

  const id = recipe._id

  const confirmDelete = () => {
    Alert.alert(
      text.detail.deleteTitle,
      fmt(text.detail.deleteBody, { title: recipe.title }),
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.actions.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await remove({ id })
              // The screen changing is the confirmation; there is nothing left
              // here to show a message on.
              router.back()
            } catch {
              haptics.actionFailed()
              setProblem(text.detail.deleteFailed)
            }
          },
        },
      ],
    )
  }

  const reEstimate = async () => {
    setEstimating(true)
    setProblem(null)
    try {
      const nutrition = await estimateNutrition({
        ingredients: recipe.ingredients,
        servings: recipe.servings,
      })
      await setNutrition({ id, nutrition, source: 'ai' })
    } catch {
      haptics.actionFailed()
      setProblem(text.form.estimateFailed)
    } finally {
      setEstimating(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: recipe.title,
          headerRight: recipe.canEdit
            ? () => (
                <View style={styles.headerActions}>
                  <HeaderButton
                    label={t.actions.edit}
                    testID="recipe-edit"
                    onPress={() =>
                      router.push(recipeHref(base, '/edit', { recipeId: id }))
                    }
                  >
                    <UI_ICONS.Pencil
                      size={19}
                      color={tokens.fg}
                      strokeWidth={1.9}
                    />
                  </HeaderButton>
                  <HeaderButton
                    label={t.actions.delete}
                    testID="recipe-delete"
                    onPress={confirmDelete}
                  >
                    <RECIPE_UI_ICONS.Trash2
                      size={19}
                      color={tokens.danger}
                      strokeWidth={1.9}
                    />
                  </HeaderButton>
                </View>
              )
            : undefined,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {recipe.imageUrl ? (
          <Image
            source={{ uri: recipe.imageUrl }}
            style={[styles.hero, { backgroundColor: tokens.tile }]}
            contentFit="cover"
            accessibilityLabel={fmt(text.form.photoOf, { title: recipe.title })}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              styles.hero,
              styles.heroEmpty,
              { backgroundColor: tint.bg },
            ]}
          >
            <RECIPE_UI_ICONS.ChefHat
              size={44}
              color={tint.fg}
              strokeWidth={1.5}
            />
          </View>
        )}

        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {recipe.title}
        </Text>

        <StarRating
          value={recipe.rating}
          testID="recipe-rating"
          accessibilityLabel={fmt(text.detail.rate, { title: recipe.title })}
          onChange={
            recipe.canEdit
              ? (rating) => {
                  haptics.selectionChanged()
                  setProblem(null)
                  rate({ id, rating: rating ?? null }).catch(() => {
                    haptics.actionFailed()
                    setProblem(text.detail.rateFailed)
                  })
                }
              : undefined
          }
        />

        {recipe.description ? (
          <Text style={[styles.body, { color: tokens.fg }]}>
            {recipe.description}
          </Text>
        ) : null}

        {recipe.tags.length ? (
          <View style={styles.tags}>
            {recipe.tags.map((tag) => (
              <Text
                key={tag}
                style={[
                  styles.tag,
                  { color: tint.fg, backgroundColor: tint.bg },
                ]}
              >
                {tag}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Where it lives, said only when that is somewhere else. This is the
            reason the stars above are inert and Edit is not in the bar. */}
        {!recipe.canEdit && recipe.homeGroupName ? (
          <Text
            testID="recipe-read-only"
            style={[styles.meta, { color: tokens.muted }]}
          >
            {fmt(text.detail.readOnly, { group: recipe.homeGroupName })}
          </Text>
        ) : null}

        {recipe.addedByName ? (
          <Text style={[styles.meta, { color: tokens.muted }]}>
            {fmt(text.detail.addedBy, { name: recipe.addedByName })}
          </Text>
        ) : null}

        {recipe.sourceUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text.detail.openSource}
            testID="recipe-source"
            onPress={() => {
              const url = recipe.sourceUrl
              if (url) openBrowserAsync(url).catch(() => {})
            }}
            style={({ pressed }) => [styles.source, pressed && styles.pressed]}
          >
            <RECIPE_UI_ICONS.ExternalLink
              size={15}
              color={tint.fg}
              strokeWidth={1.9}
            />
            <Text style={[styles.sourceLabel, { color: tint.fg }]}>
              {`${text.detail.importedFrom} ${hostOf(recipe.sourceUrl)}`}
            </Text>
          </Pressable>
        ) : null}

        {problem ? (
          <Text
            testID="recipe-problem"
            style={[styles.meta, { color: tokens.danger }]}
          >
            {problem}
          </Text>
        ) : null}

        {/* Offered to whoever may change the recipe, which is every Member of
            the Group it lives in — and only where the deployment can actually
            estimate. */}
        {recipe.nutritionStale && recipe.canEdit ? (
          <View
            style={[
              styles.stale,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
            ]}
          >
            <Text style={[styles.body, { color: tokens.fg }]}>
              {text.detail.staleNutrition}
            </Text>
            <View style={styles.staleActions}>
              {aiConfigured ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text.detail.reEstimate}
                  testID="recipe-reestimate"
                  disabled={estimating}
                  onPress={reEstimate}
                  style={({ pressed }) => [
                    styles.secondary,
                    { borderColor: tokens.border },
                    (pressed || estimating) && styles.pressed,
                  ]}
                >
                  <Text style={[styles.secondaryLabel, { color: tokens.fg }]}>
                    {estimating ? text.form.estimating : text.detail.reEstimate}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.detail.editManually}
                onPress={() =>
                  router.push(recipeHref(base, '/edit', { recipeId: id }))
                }
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: tokens.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: tokens.fg }]}>
                  {text.detail.editManually}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {recipe.nutrition ? (
          <NutritionFacts
            nutrition={recipe.nutrition}
            unitLabel={
              recipe.servings
                ? fmt(text.detail.perServingOf, { count: recipe.servings })
                : text.detail.perServing
            }
            source={recipe.nutritionSource}
          />
        ) : null}

        {recipe.ingredients.length ? (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, { color: tokens.muted }]}
            >
              {text.form.ingredients.toUpperCase()}
            </Text>
            {recipe.ingredients.map((ingredient, index) => (
              <View key={`${index}-${ingredient}`} style={styles.line}>
                <View style={[styles.bullet, { backgroundColor: tint.fg }]} />
                <Text
                  style={[styles.body, styles.lineText, { color: tokens.fg }]}
                >
                  {ingredient}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {recipe.steps.length ? (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, { color: tokens.muted }]}
            >
              {text.form.steps.toUpperCase()}
            </Text>
            {recipe.steps.map((step, index) => (
              <View key={`${index}-${step}`} style={styles.line}>
                <Text style={[styles.stepNumber, { color: tint.fg }]}>
                  {index + 1}
                </Text>
                <Text
                  style={[styles.body, styles.lineText, { color: tokens.fg }]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  )
}

function HeaderButton({
  label,
  testID,
  onPress,
  children,
}: {
  label: string
  testID: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      // The number `QuickActionSheet` settled on, and the reason
      // `docs/mobile-interaction.md` names it as the example to copy.
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  )
}

/** "www.bbcgoodfood.com/…" reads as "bbcgoodfood.com". */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.card },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontSize: 12.5,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  sourceLabel: { fontSize: 13, fontWeight: '600' },
  stale: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 10,
  },
  staleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 14, fontWeight: '600' },
  section: { gap: 7, marginTop: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineText: { flex: 1 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  stepNumber: { width: 18, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerButton: { padding: 6 },
  missing: { fontSize: 15, textAlign: 'center', paddingVertical: 40 },
  pressed: { opacity: 0.6 },
})
