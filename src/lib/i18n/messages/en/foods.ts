/**
 * The Foods module's own words.
 *
 * A food's name and brand are content — most of them come from Open Food Facts
 * or from the Catalog seed — and nothing here translates them.
 */
export const foods = {
  list: {
    title: 'Foods',
    scanHeading: 'Scan a barcode',
    search: 'Search foods',
    searchPlaceholder: 'e.g. hagelslag',
    addManually: 'Add manually',
    searching: 'Searching…',
    noResults: 'No foods found for "{term}".',
  },

  scanner: {
    scan: 'Scan barcode',
    stop: 'Stop camera',
    cameraDenied:
      'Camera access was denied or unavailable — enter the barcode number instead.',
    manualLabel: 'Or enter the barcode number',
    manualPlaceholder: '8710398160005',
    lookUp: 'Look up',
  },

  detail: {
    notFound: 'Food not found.',
    builtIn: 'Built-in',
    builtInNote:
      'Part of gather’s built-in food catalog, so it can’t be edited. Need a different version?',
    createYourOwn: 'Create your own food',
    per100: 'per 100 {unit}',
    serving: 'Serving: {label}',
    dataFrom: 'Nutrition data from',
    openFoodFacts: 'Open Food Facts',
    odbl: '(ODbL).',
    refresh: 'Refresh from Open Food Facts',
    refreshTitle: 'Refresh from Open Food Facts?',
    refreshBody:
      'This food is overwritten with the latest data there. Any local edits are replaced.',
    refreshConfirm: 'Refresh',
    refreshFailed: 'Could not refresh from Open Food Facts.',
  },

  form: {
    name: 'Name',
    brand: 'Brand',
    barcode: 'Barcode: {barcode}',
    baseUnit: 'Base unit',
    grams: 'grams',
    milliliters: 'milliliters',
    nutritionLegend: 'Nutrition per 100 {unit}',
    servingSize: 'Serving size ({unit})',
    servingLabel: 'Serving label',
    servingLabelPlaceholder: 'e.g. "1 slice (30 g)"',
    save: 'Save food',
    saveFailed: 'Could not save food',
  },

  create: {
    title: 'Add food',
    lookingUp: 'Looking up barcode…',
    fromOff: 'From Open Food Facts — review before saving.',
    offUnreachable:
      'Couldn’t reach Open Food Facts — fill in the details yourself.',
  },

  edit: {
    title: 'Edit food',
    builtInBefore:
      'This is part of gather’s built-in food catalog and can’t be edited.',
    builtInAfter: 'if you need a different version.',
  },
}
