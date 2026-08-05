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
    title: 'Dagdoelen',
    save: 'Doelen opslaan',
    saveFailed: 'Kon de doelen niet opslaan',
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
    tabs: {
      recipes: 'Recepten',
      foods: 'Voedingsmiddelen',
      quick: 'Snel toevoegen',
    },
  },

  quickAdd: {
    label: 'Omschrijving',
    placeholder: 'bijv. "Uit eten"',
    adding: 'Toevoegen…',
    failed: 'Kon dit niet noteren',
  },

  recipeAdd: {
    none: 'Nog geen recepten met voedingswaarde.',
    servings: 'porties',
    failed: 'Kon dit recept niet noteren',
    withoutNutrition: 'Deze recepten hebben nog geen voedingswaarde:',
  },

  foodAdd: {
    lookingUp: 'Opzoeken…',
    barcodeFailed: 'Kon die barcode niet opzoeken — probeer het opnieuw.',
    addFailed: 'Kon dat item niet toevoegen — probeer het opnieuw.',
    notFound: 'Niet gevonden.',
    addToLibrary: 'Voeg het toe aan de voedingsmiddelen',
    addToLibraryAfter: 'en probeer het dan opnieuw.',
    searchPlaceholder: 'Voedingsmiddelen zoeken…',
    searching: 'Zoeken bij Open Food Facts…',
    searchFailed: 'Kon niet zoeken bij Open Food Facts.',
    fromOff: 'Van Open Food Facts',
    perHundred: '{calories} kcal/100 g',
    pieceOf: 'stuk ({size}{unit})',
    logFailed: 'Kon dit voedingsmiddel niet noteren',
  },
} satisfies typeof enDiary

export const nutrition = { meals, units, diary } satisfies typeof enNutrition
