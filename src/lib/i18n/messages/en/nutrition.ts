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
    /**
     * The meal's own kcal, beside its name. Only ever shown when at least one
     * entry in the slot carries calories — a meal of things nobody has
     * nutrition figures for says nothing rather than "0 kcal".
     */
    subtotal: '{calories} kcal',
  },

  entry: {
    viewRecipe: 'View recipe',
    viewFood: 'View food',
    /**
     * The badge on a row a Combo logged. The badge itself shows the Combo's
     * name — content, never translated — so this is the sentence that says
     * what the name means, for a tooltip and for a screen reader.
     */
    fromCombo: 'Logged by the combo “{name}”',
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
    saveTitle: 'Save these entries as a combo',
    namePlaceholder: 'e.g. "Work lunch"',
    saveFailed: 'Could not save this combo',
    /**
     * Saving picks entries out of a meal and takes their place (#99), so the
     * ticking and what it costs both have to be said before the name is typed.
     */
    selectEntry: 'Include {label}',
    selectHint:
      'Tick what goes in the combo. Those entries are replaced by it; the rest of the meal stays.',
    selectNothing: 'Tick at least one entry.',
    /**
     * The refusals `combos.saveFromMeal` answers with. It throws a key and
     * this resolves it: the server cannot know which language it is being
     * read in, so a sentence built there reaches a Dutch reader in English
     * (ADR-0011).
     */
    comboNothingSelected: 'Tick at least one entry.',
    comboComponentUnavailable:
      'Something here can no longer be logged, so nothing was changed.',
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
    review: 'Check first',
    reviewHint:
      'Imports this food with Open Food Facts’ figures. Check first to review or correct them.',
    importFailed: 'Couldn’t add this food — try again.',
    editFood: 'Edit food details',
    addToLibrary: 'Add it to the foods library',
    addToLibraryAfter: 'first.',
    searching: 'Searching Open Food Facts…',
    searchFailed: 'Couldn’t search Open Food Facts.',
    perHundred: '{calories} kcal/100g',
    pieceOf: 'piece ({size}{unit})',
  },
}

export const nutrition = { meals, units, diary }
