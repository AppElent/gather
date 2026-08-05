import type {
  MealName,
  QuantityUnit,
} from '../../../../../convex/lib/consumption'

/**
 * Meal names, moved out of `convex/lib/consumption.ts` for the same reason the
 * nutrient labels left `lib/nutrition.ts`: no Convex function read them, three
 * client components did, and they are words a person reads (ADR-0011).
 */
export const meals = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
} satisfies Record<MealName, string>

/** How much of something was eaten. Grams and millilitres are symbols, not words. */
export const units = {
  serving: 'serving',
  g: 'g',
  ml: 'ml',
  piece: 'piece',
} satisfies Record<QuantityUnit, string>

export const diary = {
  personalNote:
    'Yours alone. Nobody else in the group can see it, and it looks the same whichever group you are in.',
  prevDay: '← Prev',
  nextDay: 'Next →',

  totalsToday: "Today's totals",
  totalsOn: 'Totals — {date}',

  targets: {
    title: 'Daily targets',
    save: 'Save targets',
    saveFailed: 'Could not save targets',
  },

  slot: {
    add: '+ Add',
    empty: 'Nothing logged yet.',
  },

  entry: {
    viewRecipe: 'View recipe',
    viewFood: 'View food',
    quantity: 'Qty',
    meal: 'Meal',
    date: 'Date',
    saveFailed: 'Could not save changes',
  },

  add: {
    title: 'Add to {meal}',
    tabs: {
      recipes: 'Recipes',
      foods: 'Foods',
      quick: 'Quick add',
    },
  },

  quickAdd: {
    label: 'Label',
    placeholder: 'e.g. "Restaurant meal"',
    adding: 'Adding…',
    failed: 'Could not log this',
  },

  recipeAdd: {
    none: 'No recipes with nutrition data yet.',
    servings: 'servings',
    failed: 'Could not log this recipe',
    withoutNutrition: 'These recipes have no nutrition data yet:',
  },

  foodAdd: {
    lookingUp: 'Looking up…',
    barcodeFailed: 'Couldn’t look up that barcode — try again.',
    addFailed: 'Couldn’t add that item — try again.',
    notFound: 'Not found.',
    addToLibrary: 'Add it to the foods library',
    addToLibraryAfter: 'first.',
    searchPlaceholder: 'Search foods…',
    searching: 'Searching Open Food Facts…',
    searchFailed: 'Couldn’t search Open Food Facts.',
    fromOff: 'From Open Food Facts',
    perHundred: '{calories} kcal/100g',
    pieceOf: 'piece ({size}{unit})',
    logFailed: 'Could not log this food',
  },
}

export const nutrition = { meals, units, diary }
