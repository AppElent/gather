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

  /**
   * The target as *context* on the day's totals. Setting one is a preference
   * and lives in Settings; these are the words around the figure you read
   * every day.
   */
  targets: {
    edit: 'Edit targets',
    remaining: '{amount} left',
    over: '{amount} over',
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

  /**
   * The add sheet. One list, no tabs: every row is a card, every card expands
   * in place, and nothing reaches the diary until the confirm inside it.
   */
  add: {
    title: 'Add to {meal}',
    searchPlaceholder: 'Search foods and recipes…',
    searchHint: 'Search for a food, or scan a barcode.',
    scan: 'Scan',
    hideScanner: 'Hide scanner',
    sections: {
      scanned: 'Scanned',
      foods: 'Your foods',
      recipes: 'Recipes',
      off: 'Open Food Facts',
    },
    amount: 'Amount',
    unit: 'Unit',
    enterAmount: 'Enter an amount above 0',
    confirm: 'Add to diary',
    logFailed: 'Could not log this',
    nothingFound: 'Nothing found for “{term}”',
    oneOffTitle: 'Log “{term}” as a one-off',
    oneOffHint: 'Fill in whatever figures you have — a partial record is fine.',
    logged: '{label} logged',
    undo: 'Undo',
    undoFailed: 'Could not undo that',
  },

  recipeAdd: {
    servings: 'servings',
    perServing: '{calories} kcal/serving',
  },

  foodAdd: {
    barcodeFailed: 'Couldn’t look up that barcode — try again.',
    addFailed: 'Couldn’t add that item — try again.',
    notFound: 'Not found.',
    addToLibrary: 'Add it to the foods library',
    addToLibraryAfter: 'first.',
    searching: 'Searching Open Food Facts…',
    searchFailed: 'Couldn’t search Open Food Facts.',
    perHundred: '{calories} kcal/100g',
    pieceOf: 'piece ({size}{unit})',
  },
}

export const nutrition = { meals, units, diary }
