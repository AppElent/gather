/**
 * The Recipes module's own words.
 *
 * A recipe's title, its ingredients, its steps and its tags are content — the
 * person who typed them chose those words, and nothing here translates them.
 * What is here is the frame around them.
 */
export const recipes = {
  list: {
    subtitle: 'Keep and rate the dishes this group cooks.',
    add: 'Add recipe',
    emptyTitle: 'No recipes yet',
    emptyBody: 'Add the first recipe to make this module useful for the group.',
    emptyAction: 'Add your first recipe',

    /**
     * The phone's collection screen. It filters what it already has rather
     * than asking the server again, so "nothing found" is about the words
     * somebody typed and never about the connection.
     */
    search: 'Search recipes',
    clearSearch: 'Clear search',
    noResultsTitle: 'Nothing found',
    noResultsBody: 'No recipe here matches "{query}".',
    /** The badge on a row that lives in another Group and was shared into this one. */
    livesIn: 'From {group}',
    /** The accessible name of a row; `{title}` is the recipe's own words. */
    openRecipe: 'Open {title}',
  },

  viewMode: {
    label: 'Recipe view',
    grid: 'Grid view',
    banner: 'Banner view',
    compact: 'Compact view',
  },

  rating: {
    label: 'Rating',
    stars: { one: '{count} star', other: '{count} stars' },
  },

  /**
   * Split around the Group's name, which is rendered in bold between the two
   * halves, and split again on whether the Group was chosen or fallen back to.
   */
  destination: {
    prefix: 'Adding to',
    suffix: '.',
    fallbackSuffix:
      '— your personal group, because this page is not inside one.',
  },

  form: {
    title: 'Title',
    description: 'Description',
    ingredients: 'Ingredients',
    steps: 'Steps',
    tags: 'Tags',
    onePerLine: 'One per line',
    commaSeparated: 'comma, separated',
    nutritionLegend: 'Nutrition (per serving)',
    servings: 'Servings',
    servingsPlaceholder: '4',
    estimate: 'Estimate with AI',
    estimating: 'Estimating…',
    estimateFailed: 'Could not estimate nutrition',
    save: 'Save recipe',
    saving: 'Saving…',
    saveFailed: 'Could not save recipe',

    /**
     * Why a title is missing rather than what to do about it. The form holds
     * the key and resolves it at render, so a validator never carries an
     * English sentence around with it (ADR-0011).
     */
    titleRequired: 'A recipe needs a title.',

    /**
     * The phone's destination notice. The web splits its own around a bolded
     * Group name because it can style the halves; one sentence with the name
     * in it does the same job in a place with no fallback Group to explain
     * — the Group on a phone is ambient and always chosen (ADR-0015).
     */
    destination: 'Saving to {group}.',

    /**
     * The photo row. Only the phone draws these — the web's recipe form has
     * no photo control at all — and they live here for the reason the Baby
     * log's do: a Module's words are the Module's, whichever client renders
     * them (ADR-0017).
     */
    photo: 'Photo',
    takePhoto: 'Take a photo',
    choosePhoto: 'Choose a photo',
    replacePhoto: 'Replace photo',
    removePhoto: 'Remove photo',
    photoOf: 'Photo of {title}',
    photoUploading: 'Adding photo…',
    photoDenied:
      'Gather has not been given access to that. You can still save without a photo.',
    photoFailed: 'That photo could not be added.',
  },

  create: {
    title: 'New recipe',
    importLabel: 'Import from URL',
    importPlaceholder: 'https://example.com/some-recipe',
    import: 'Import',
    importing: 'Importing…',
    imported: 'Imported — review the details below, then save.',
    importFailed: 'Could not import that recipe',

    /**
     * The sheet behind the collection's add control. Importing is the phone's
     * reason to exist here, so it is first and the Add tab offers only it;
     * writing one out by hand is reachable from this sheet and advertised
     * nowhere.
     */
    chooseTitle: 'Add a recipe',
    chooseImport: 'Import from a link',
    chooseImportBody: 'Paste a link and the details are filled in for you.',
    chooseBlank: 'Write it yourself',
    chooseBlankBody: 'A blank recipe to type out.',
    /** The address bar on the import screen. */
    linkLabel: 'Recipe link',
    review: 'Review what came back, then save.',
  },

  edit: {
    title: 'Edit recipe',
  },

  detail: {
    notFound: 'Recipe not found.',
    deleteFailed: 'Could not delete recipe',
    addedBy: 'Added by {name}',
    importedFrom: 'Imported from',
    staleNutrition:
      'Ingredients changed since nutrition was calculated — re-estimate?',
    reEstimate: 'Re-estimate with AI',
    editManually: 'Edit manually',
    perServing: 'per serving',
    perServingOf: 'per serving · {count} servings',
    nutrition: 'Nutrition',

    /**
     * Phone-only. The web puts Edit and Delete in a row of buttons and the
     * Group in the URL; here the stars are the control, the menu holds the
     * verbs, and a recipe you may only read has to say why.
     */
    rate: 'Rate {title}',
    rateFailed: 'That rating could not be saved.',
    clearRating: 'Clear rating',
    readOnly: 'Lives in {group}, so it is read-only here.',
    deleteTitle: 'Delete recipe?',
    deleteBody: 'Delete "{title}"? This cannot be undone.',
    openSource: 'Open the original',
  },

  sharing: {
    title: 'Groups',
    livesIn: 'Lives in',
    unknownGroup: 'a group you are in',
    notShared: 'Not shared with any other group.',
    sharedWith: 'Shared with {group}',
    unshare: 'Unshare',
    onlyOneGroup:
      'You are only in one group, so there is nowhere to move or share this to yet.',
    moveTo: 'Move to',
    move: 'Move',
    shareWith: 'Share with',
    share: 'Share',
    chooseGroup: 'Choose a group…',
  },
}
