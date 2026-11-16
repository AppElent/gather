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
 * `apps/mobile/DESIGN_SYSTEM.md` sets for an optimistic write. The star fills
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
import { isAiLimitReached } from '@gather/core/ai-limit'
import { useAction, useMutation } from 'convex/react'
import { useKeepAwake } from 'expo-keep-awake'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { openBrowserAsync } from 'expo-web-browser'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { FactsStrip } from '../../ui/facts-strip'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { PhotoHeader, usePhotoTitle } from '../../ui/photo-header'
import {
  pendingScreenOptions,
  photoScreenOptions,
  washScreenOptions,
} from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { RECIPE_UI_ICONS } from './icons'
import { NutritionFacts } from './NutritionFacts'
import { StarRating } from './StarRating'
import { useRecipes } from './useRecipes'

export function RecipeScreen() {
  useKeepAwake()

  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { groupSlug } = useRecipes()
  const photoTitle = usePhotoTitle()
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

  useRecordRecent(
    recipe && recipe !== null
      ? {
          id: recipe._id,
          type: 'recipe',
          title: recipe.title,
          detail: recipe.tags.join(', '),
        }
      : null,
  )

  const text = t.recipes

  if (recipe === undefined)
    return (
      <>
        <Stack.Screen
          options={pendingScreenOptions(t.modules.byId.recipes.label)}
        />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.ground }}
        >
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        </ScrollView>
      </>
    )

  if (recipe === null)
    return (
      <>
        <Stack.Screen
          options={pendingScreenOptions(t.modules.byId.recipes.label)}
        />
        <View style={[styles.fill, { backgroundColor: tokens.ground }]}>
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
    confirmDestructive({
      title: text.detail.deleteTitle,
      message: fmt(text.detail.deleteBody, { title: recipe.title }),
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: async () => {
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
    })
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
    } catch (error) {
      haptics.actionFailed()
      setProblem(
        isAiLimitReached(error)
          ? text.form.aiLimitReached
          : text.form.estimateFailed,
      )
    } finally {
      setEstimating(false)
    }
  }

  const photo = recipe.imageUrl
  const byLine = recipe.addedByName
    ? fmt(text.detail.byLine, { name: recipe.addedByName })
    : undefined
  const moduleLabel = t.modules.byId.recipes.label
  const fact = (
    count: number | undefined,
    unit: { one: string; other: string },
  ) =>
    count ? { value: String(count), unit: plural(locale, count, unit) } : null

  return (
    <>
      <Stack.Screen
        options={{
          // A recipe with a photo opens on it; one without opens on the
          // group's wash under the native large title. Either way the title is
          // drawn once.
          ...(photo
            ? photoScreenOptions(recipe.title, photoTitle.shown, tokens.ink)
            : washScreenOptions(recipe.title)),
          headerRight: recipe.canEdit
            ? () => (
                <View style={styles.headerActions}>
                  <HeaderButton
                    label={t.common.actions.edit}
                    testID="recipe-edit"
                    onPress={() =>
                      router.push(
                        moduleHref('/all/recipes/edit', { recipeId: id }),
                      )
                    }
                  >
                    <UI_ICONS.Pencil
                      size={19}
                      color={tokens.ink}
                      strokeWidth={1.9}
                    />
                  </HeaderButton>
                  <HeaderButton
                    label={t.common.actions.delete}
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
        onScroll={photo ? photoTitle.onScroll : undefined}
        scrollEventThrottle={16}
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {photo ? (
          <>
            <PhotoHeader
              photo={{
                uri: photo,
                alt: fmt(text.form.photoOf, { title: recipe.title }),
              }}
              group="kitchen"
              glyph={MODULE_ICONS.ChefHat}
              eyebrow={byLine ? `${moduleLabel} · ${byLine}` : moduleLabel}
              title={recipe.title}
              onTitleBottom={photoTitle.onTitleBottom}
            />
            <View style={styles.facts}>
              <FactsStrip
                facts={[
                  fact(recipe.servings, text.detail.facts.servings),
                  fact(
                    recipe.ingredients.length,
                    text.detail.facts.ingredients,
                  ),
                  fact(recipe.steps.length, text.detail.facts.steps),
                ]}
              />
            </View>
          </>
        ) : (
          <WashHeader
            group="kitchen"
            glyph={MODULE_ICONS.ChefHat}
            summary={{
              count: plural(
                locale,
                recipe.ingredients.length,
                text.detail.ingredientCount,
              ),
              scope: byLine,
            }}
          />
        )}

        <View style={styles.content}>
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
            <Text style={[styles.body, { color: tokens.ink }]}>
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
                    { color: tokens.ink, backgroundColor: tokens.surface2 },
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

          {recipe.sourceUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={text.detail.openSource}
              testID="recipe-source"
              onPress={() => {
                const url = recipe.sourceUrl
                if (url) openBrowserAsync(url).catch(() => {})
              }}
              style={({ pressed }) => [
                styles.source,
                pressed && styles.pressed,
              ]}
            >
              <RECIPE_UI_ICONS.ExternalLink
                size={15}
                color={tint.text}
                strokeWidth={1.9}
              />
              <Text style={[styles.sourceLabel, { color: tint.text }]}>
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
                { borderColor: tokens.hair, backgroundColor: tokens.surface },
              ]}
            >
              <Text style={[styles.body, { color: tokens.ink }]}>
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
                      { borderColor: tokens.hair },
                      (pressed || estimating) && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.secondaryLabel, { color: tokens.ink }]}
                    >
                      {estimating
                        ? text.form.estimating
                        : text.detail.reEstimate}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text.detail.editManually}
                  onPress={() =>
                    router.push(
                      moduleHref('/all/recipes/edit', { recipeId: id }),
                    )
                  }
                  style={({ pressed }) => [
                    styles.secondary,
                    { borderColor: tokens.hair },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.secondaryLabel, { color: tokens.ink }]}>
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
              <SectionLabel>{text.form.ingredients}</SectionLabel>
              <InsetList>
                {recipe.ingredients.map((ingredient, index) => (
                  <InsetRow key={`${index}-${ingredient}`} title={ingredient} />
                ))}
              </InsetList>
            </View>
          ) : null}

          {recipe.steps.length ? (
            <View style={styles.section}>
              <SectionLabel>{text.form.steps}</SectionLabel>
              <InsetList>
                {recipe.steps.map((step, index) => (
                  <InsetRow
                    key={`${index}-${step}`}
                    leading={
                      <Text
                        style={[styles.stepNumber, { color: tokens.muted }]}
                      >
                        {index + 1}
                      </Text>
                    }
                    title={step}
                  />
                ))}
              </InsetList>
            </View>
          ) : null}
        </View>
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
      // `apps/mobile/DESIGN_SYSTEM.md` names it as the example to copy.
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
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: 10 },
  facts: { paddingHorizontal: SPACE[4], paddingTop: SPACE[4] },
  body: { ...TYPE.subhead },
  meta: { ...TYPE.footnote },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    ...TYPE.footnoteStrong,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  sourceLabel: { ...TYPE.footnoteStrong },
  stale: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 10,
  },
  staleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...TYPE.bodyStrong },
  section: { gap: SPACE[2], marginTop: SPACE[2] },
  stepNumber: { ...TYPE.bodyStrong, ...TABULAR, minWidth: 18 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerButton: { padding: 6 },
  missing: { ...TYPE.subhead, textAlign: 'center', paddingVertical: 40 },
  pressed: { opacity: 0.6 },
})
