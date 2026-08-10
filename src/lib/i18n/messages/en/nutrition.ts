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
    clearSearch: 'Clear search',
    scan: 'Scan',
    hideScanner: 'Hide scanner',
    addFood: 'Add food',
    addOptions: 'Add',
    sections: {
      scanned: 'Scanned',
      /** The food a review form just saved, handed back ready to log (#93/#79). */
      justAdded: 'Just added',
      foods: 'Your foods',
      recipes: 'Recipes',
      off: 'Open Food Facts',
    },
    amount: 'Amount',
    unit: 'Unit',
    custom: 'Custom',
    /** Marks a serving that came from your own logging rather than the food. */
    yourAmount: '(yours)',
    enterAmount: 'Enter an amount above 0',
    confirm: 'Add to diary',
    logFailed: 'Could not log this',
    nothingFound: 'Nothing found for “{term}”',
    oneOffTitle: 'Log “{term}” as a one-off',
    oneOffHint: 'Fill in whatever figures you have — a partial record is fine.',
    /**
     * The other half of an empty result (#79). A one-off is right for a
     * restaurant meal and wrong for a product you will eat again, which is
     * something only the person typing knows.
     */
    addAsFood: 'Add “{term}” to my foods',
    oneOffTitleEmpty: 'Log a one-off',
    oneOffName: 'What did you have?',
    enterOneOffName: 'Enter what you had',
    logged: '{label} logged',
    undo: 'Undo',
    undoFailed: 'Could not undo that',
  },

  /**
   * The Combo — a named, reusable set of things you log together (ADR-0012).
   * "Combo" is the domain term and stays capitalised nowhere in the UI, but it
   * is deliberately not "meal" (which names the slot) or "food group".
   */
  combos: {
    section: 'Combos',
    itemCount: { one: '{count} item', other: '{count} items' },
    kcal: '{calories} kcal',
    amount: '{quantity} {unit}',
    unavailable: 'Not available any more',
    less: 'Less {label}',
    more: 'More {label}',
    reset: 'Reset',
    nothingLeft: 'Nothing left to log',
    save: 'Save as combo',
    saveTitle: 'Save this meal as a combo',
    namePlaceholder: 'e.g. "Work lunch"',
    saveFailed: 'Could not save this combo',
    saved: '“{name}” saved',
    update: 'Update {name}',
    updateFailed: 'Could not update that combo',
  },

  recipeAdd: {
    servings: 'servings',
    perServing: '{calories} kcal/serving',
  },

  foodAdd: {
    barcodeFailed: 'Couldn’t look up that barcode — try again.',
    notFound: 'Not found.',
    /** What choosing an Open Food Facts result does now: opens it, saves nothing (#93). */
    review: 'Check and add',
    reviewHint:
      'Open Food Facts data is often incomplete. Check it, then saving adds the food and brings you back here to log it.',
    addToLibrary: 'Add it to the foods library',
    addToLibraryAfter: 'first.',
    searching: 'Searching Open Food Facts…',
    searchFailed: 'Couldn’t search Open Food Facts.',
    perHundred: '{calories} kcal/100g',
    pieceOf: 'piece ({size}{unit})',
  },
}

export const nutrition = { meals, units, diary }
