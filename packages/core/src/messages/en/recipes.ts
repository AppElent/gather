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
    saveFailed: 'Could not save recipe',
  },

  create: {
    title: 'New recipe',
    importLabel: 'Import from URL',
    importPlaceholder: 'https://example.com/some-recipe',
    import: 'Import',
    importing: 'Importing…',
    imported: 'Imported — review the details below, then save.',
    importFailed: 'Could not import that recipe',
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
