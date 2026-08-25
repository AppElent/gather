/**
 * The recipe form, wherever a recipe is being written down.
 *
 * One component behind all three doors — importing, writing from blank, and
 * correcting a saved one — for the reason `EntryFields` is shared in the Baby
 * log: creating a thing and fixing it must not be able to drift into two
 * different sets of fields.
 *
 * It holds no state of its own beyond the nutrition estimate's spinner. The
 * values and the storage id belong to the screen, because those are what a save
 * sends; everything else here is layout.
 *
 * ## What is not here
 *
 * No per-nutrient inputs, and no Group picker. The first is `recipeForm.ts`'s
 * decision — the phone offers an estimate rather than eight number pads — and
 * the second is ADR-0015's: the Group is ambient, so the destination is a
 * sentence naming it and never a control that changes it.
 */
import type { NutrientKey, NutritionSource } from '@gather/core/domain'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { PhotoField } from '../../components/PhotoField'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { NutritionFacts } from './NutritionFacts'
import type { RecipeFormValues } from './recipeForm'
import { StarRating } from './StarRating'

type Facts = Partial<Record<NutrientKey, number>>

export interface RecipeFieldsProps {
  values: RecipeFormValues
  onChange: (next: RecipeFormValues) => void
  /** The photo already on this recipe, if it has one. */
  photoUrl?: string | null
  /** `undefined` unchanged, an id once picked, `null` once taken off. */
  photoId: string | null | undefined
  onPhotoChange: (storageId: string | null) => void
  generateUploadUrl: () => Promise<string>
  /**
   * Estimating nutrition, when the deployment has an AI key. Absent means the
   * control is simply not drawn — an estimate button on a deployment that
   * cannot estimate is an offer that can only fail.
   */
  onEstimate?: (args: {
    ingredients: string[]
    servings?: number
  }) => Promise<Facts>
  disabled?: boolean
}

export function RecipeFields({
  values,
  onChange,
  photoUrl,
  photoId,
  onPhotoChange,
  generateUploadUrl,
  onEstimate,
  disabled,
}: RecipeFieldsProps) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const text = t.recipes.form
  const [estimating, setEstimating] = useState(false)
  const [estimateProblem, setEstimateProblem] = useState<string | null>(null)

  const set = <K extends keyof RecipeFormValues>(
    key: K,
    value: RecipeFormValues[K],
  ) => onChange({ ...values, [key]: value })

  const ingredientLines = values.ingredients
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  async function estimate() {
    if (!onEstimate) return
    setEstimating(true)
    setEstimateProblem(null)
    try {
      const servings = Number(values.servings.trim())
      const facts = await onEstimate({
        ingredients: ingredientLines,
        servings:
          Number.isFinite(servings) && servings >= 1 ? servings : undefined,
      })
      onChange({
        ...values,
        nutrition: facts,
        nutritionSource: 'ai' satisfies NutritionSource,
      })
    } catch {
      setEstimateProblem(text.estimateFailed)
    } finally {
      setEstimating(false)
    }
  }

  return (
    <View style={styles.fields}>
      <Field label={text.title}>
        <Input
          value={values.title}
          onChangeText={(next) => set('title', next)}
          editable={!disabled}
          autoFocus={!values.title}
          testID="recipe-title"
        />
      </Field>

      <Field label={text.description}>
        <Input
          value={values.description}
          onChangeText={(next) => set('description', next)}
          editable={!disabled}
          multiline
          minHeight={72}
          testID="recipe-description"
        />
      </Field>

      <PhotoField
        photoUrl={photoUrl}
        value={photoId}
        onChange={onPhotoChange}
        generateUploadUrl={generateUploadUrl}
        preset="recipePhoto"
        group="kitchen"
        disabled={disabled}
        testID="recipe-photo"
        labels={{
          heading: text.photo,
          take: text.takePhoto,
          choose: text.choosePhoto,
          replace: text.replacePhoto,
          remove: text.removePhoto,
          uploading: text.photoUploading,
          denied: text.photoDenied,
          failed: text.photoFailed,
          alt: fmt(text.photoOf, {
            title: values.title || t.modules.byId.recipes.label,
          }),
        }}
      />

      <Field label={text.ingredients} hint={text.onePerLine}>
        <Input
          value={values.ingredients}
          onChangeText={(next) => set('ingredients', next)}
          editable={!disabled}
          multiline
          minHeight={132}
          testID="recipe-ingredients"
        />
      </Field>

      <Field label={text.steps} hint={text.onePerLine}>
        <Input
          value={values.steps}
          onChangeText={(next) => set('steps', next)}
          editable={!disabled}
          multiline
          minHeight={132}
          testID="recipe-steps"
        />
      </Field>

      <Field label={text.tags} hint={text.commaSeparated}>
        <Input
          value={values.tags}
          onChangeText={(next) => set('tags', next)}
          editable={!disabled}
          testID="recipe-tags"
        />
      </Field>

      <Field label={text.servings}>
        <Input
          value={values.servings}
          onChangeText={(next) => set('servings', next)}
          editable={!disabled}
          keyboardType="number-pad"
          placeholder={text.servingsPlaceholder}
          testID="recipe-servings"
        />
      </Field>

      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>
          {t.recipes.rating.label.toUpperCase()}
        </Text>
        <StarRating
          value={values.rating}
          onChange={(rating) => set('rating', rating)}
          testID="recipe-form-rating"
          accessibilityLabel={t.recipes.rating.label}
        />
      </View>

      {values.nutrition ? (
        <NutritionFacts
          nutrition={values.nutrition}
          unitLabel={t.recipes.detail.perServing}
          source={values.nutritionSource}
        />
      ) : null}

      {onEstimate ? (
        <View style={styles.field}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.estimate}
            testID="recipe-estimate"
            disabled={disabled || estimating || ingredientLines.length === 0}
            onPress={estimate}
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
              (pressed ||
                disabled ||
                estimating ||
                ingredientLines.length === 0) &&
                styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: tokens.fg }]}>
              {estimating ? text.estimating : text.estimate}
            </Text>
          </Pressable>
          {estimateProblem ? (
            <Text style={[styles.problem, { color: tokens.danger }]}>
              {estimateProblem}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  const tokens = useTokens('kitchen')
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.muted }]}>
        {label.toUpperCase()}
        {hint ? <Text style={styles.hint}>{`  ${hint}`}</Text> : null}
      </Text>
      {children}
    </View>
  )
}

function Input({
  minHeight,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { minHeight?: number }) {
  const tokens = useTokens('kitchen')
  return (
    <TextInput
      {...props}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={tokens.muted}
      style={[
        styles.input,
        {
          color: tokens.fg,
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
        minHeight ? { minHeight } : null,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  fields: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  hint: { fontWeight: '400', letterSpacing: 0 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 46,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 15, fontWeight: '600' },
  problem: { fontSize: 13 },
  pressed: { opacity: 0.6 },
})
