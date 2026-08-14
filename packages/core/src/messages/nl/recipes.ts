import type { recipes as enRecipes } from '../en/recipes'

export const recipes = {
  list: {
    subtitle: 'Bewaar en beoordeel de gerechten die deze Groep kookt.',
    add: 'Recept toevoegen',
    emptyTitle: 'Nog geen recepten',
    emptyBody:
      'Voeg het eerste recept toe om deze module bruikbaar te maken voor de Groep.',
    emptyAction: 'Voeg je eerste recept toe',
  },

  viewMode: {
    label: 'Weergave',
    grid: 'Rasterweergave',
    banner: 'Bannerweergave',
    compact: 'Compacte weergave',
  },

  rating: {
    label: 'Beoordeling',
    stars: { one: '{count} ster', other: '{count} sterren' },
  },

  destination: {
    prefix: 'Wordt toegevoegd aan',
    suffix: '.',
    fallbackSuffix:
      '— je persoonlijke Groep, omdat deze pagina niet in een Groep zit.',
  },

  form: {
    title: 'Titel',
    description: 'Omschrijving',
    ingredients: 'Ingrediënten',
    steps: 'Stappen',
    tags: 'Labels',
    onePerLine: 'Eén per regel',
    commaSeparated: 'komma, gescheiden',
    nutritionLegend: 'Voedingswaarde (per portie)',
    servings: 'Porties',
    servingsPlaceholder: '4',
    estimate: 'Schatten met AI',
    estimating: 'Schatten…',
    estimateFailed: 'Kon de voedingswaarde niet schatten',
    save: 'Recept opslaan',
    saveFailed: 'Kon het recept niet opslaan',
  },

  create: {
    title: 'Nieuw recept',
    importLabel: 'Importeren vanaf URL',
    importPlaceholder: 'https://voorbeeld.nl/een-recept',
    import: 'Importeren',
    importing: 'Importeren…',
    imported: 'Geïmporteerd — controleer hieronder de gegevens en sla dan op.',
    importFailed: 'Kon dat recept niet importeren',
  },

  edit: {
    title: 'Recept bewerken',
  },

  detail: {
    notFound: 'Recept niet gevonden.',
    deleteFailed: 'Kon het recept niet verwijderen',
    addedBy: 'Toegevoegd door {name}',
    importedFrom: 'Geïmporteerd van',
    staleNutrition:
      'De ingrediënten zijn gewijzigd sinds de voedingswaarde is berekend — opnieuw schatten?',
    reEstimate: 'Opnieuw schatten met AI',
    editManually: 'Handmatig bewerken',
    perServing: 'per portie',
    perServingOf: 'per portie · {count} porties',
    nutrition: 'Voedingswaarde',
  },

  sharing: {
    title: 'Groepen',
    livesIn: 'Hoort bij',
    unknownGroup: 'een Groep waar je in zit',
    notShared: 'Niet gedeeld met een andere Groep.',
    sharedWith: 'Gedeeld met {group}',
    unshare: 'Delen stoppen',
    onlyOneGroup:
      'Je zit maar in één Groep, dus er is nog nergens om dit heen te verplaatsen of mee te delen.',
    moveTo: 'Verplaatsen naar',
    move: 'Verplaatsen',
    shareWith: 'Delen met',
    share: 'Delen',
    chooseGroup: 'Kies een Groep…',
  },
} satisfies typeof enRecipes
