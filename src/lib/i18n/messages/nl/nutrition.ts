import type {
  diary as enDiary,
  meals as enMeals,
  nutrition as enNutrition,
  units as enUnits,
} from '../en/nutrition'

export const meals = {
  breakfast: 'Ontbijt',
  lunch: 'Lunch',
  dinner: 'Avondeten',
  snack: 'Tussendoortje',
} satisfies typeof enMeals

export const units = {
  serving: 'portie',
  g: 'g',
  ml: 'ml',
  piece: 'stuk',
} satisfies typeof enUnits

export const diary = {
  personalNote:
    'Alleen van jou. Niemand anders in de Groep ziet dit, en het is in elke Groep hetzelfde.',
  prevDay: '← Vorige',
  nextDay: 'Volgende →',

  totalsToday: 'Totalen van vandaag',
  totalsOn: 'Totalen — {date}',

  targets: {
    edit: 'Doelen aanpassen',
    remaining: 'nog {amount}',
    over: '{amount} te veel',
  },

  slot: {
    add: '+ Toevoegen',
    empty: 'Nog niets genoteerd.',
  },

  entry: {
    viewRecipe: 'Recept bekijken',
    viewFood: 'Voedingsmiddel bekijken',
    quantity: 'Aantal',
    meal: 'Maaltijd',
    date: 'Datum',
    saveFailed: 'Kon de wijzigingen niet opslaan',
  },

  add: {
    title: 'Toevoegen aan {meal}',
    searchPlaceholder: 'Voedingsmiddelen en recepten zoeken…',
    searchHint: 'Zoek een voedingsmiddel, of scan een barcode.',
    clearSearch: 'Zoekopdracht wissen',
    scan: 'Scannen',
    hideScanner: 'Scanner verbergen',
    sections: {
      scanned: 'Gescand',
      justAdded: 'Net toegevoegd',
      foods: 'Jouw voedingsmiddelen',
      recipes: 'Recepten',
      off: 'Open Food Facts',
    },
    amount: 'Hoeveelheid',
    unit: 'Eenheid',
    custom: 'Anders',
    yourAmount: '(van jou)',
    enterAmount: 'Vul een hoeveelheid boven 0 in',
    confirm: 'Aan dagboek toevoegen',
    logFailed: 'Kon dit niet noteren',
    nothingFound: 'Niets gevonden voor “{term}”',
    oneOffTitle: '“{term}” eenmalig noteren',
    oneOffHint:
      'Vul in wat je weet — een gedeeltelijke notitie is beter dan niets.',
    addAsFood: '“{term}” toevoegen aan mijn voedingsmiddelen',
    logged: '{label} genoteerd',
    undo: 'Ongedaan maken',
    undoFailed: 'Kon dat niet ongedaan maken',
  },

  combos: {
    section: 'Combinaties',
    itemCount: { one: '{count} onderdeel', other: '{count} onderdelen' },
    kcal: '{calories} kcal',
    amount: '{quantity} {unit}',
    unavailable: 'Niet meer beschikbaar',
    less: 'Minder {label}',
    more: 'Meer {label}',
    reset: 'Herstellen',
    nothingLeft: 'Niets meer om te noteren',
    save: 'Opslaan als combinatie',
    saveTitle: 'Deze maaltijd opslaan als combinatie',
    namePlaceholder: 'bijv. "Lunch op het werk"',
    saveFailed: 'Kon deze combinatie niet opslaan',
    saved: '“{name}” opgeslagen',
    update: '{name} bijwerken',
    updateFailed: 'Kon die combinatie niet bijwerken',
  },

  recipeAdd: {
    servings: 'porties',
    perServing: '{calories} kcal/portie',
  },

  foodAdd: {
    barcodeFailed: 'Kon die barcode niet opzoeken — probeer het opnieuw.',
    notFound: 'Niet gevonden.',
    review: 'Eerst controleren',
    reviewHint:
      'Voegt dit voedingsmiddel toe met gegevens van Open Food Facts. Controleer het eerst om ze na te kijken of te wijzigen.',
    importFailed:
      'Kon dit voedingsmiddel niet toevoegen — probeer het opnieuw.',
    addToLibrary: 'Voeg het toe aan de voedingsmiddelen',
    addToLibraryAfter: 'en probeer het dan opnieuw.',
    searching: 'Zoeken bij Open Food Facts…',
    searchFailed: 'Kon niet zoeken bij Open Food Facts.',
    perHundred: '{calories} kcal/100 g',
    pieceOf: 'stuk ({size}{unit})',
  },
} satisfies typeof enDiary

export const nutrition = { meals, units, diary } satisfies typeof enNutrition
