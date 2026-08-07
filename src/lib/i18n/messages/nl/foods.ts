import type { foods as enFoods } from '../en/foods'

export const foods = {
  list: {
    title: 'Voedingsmiddelen',
    scanHeading: 'Scan een barcode',
    search: 'Voedingsmiddelen zoeken',
    searchPlaceholder: 'bijv. hagelslag',
    addManually: 'Handmatig toevoegen',
    searching: 'Zoeken…',
    noResults: 'Niets gevonden voor "{term}".',
  },

  scanner: {
    scan: 'Barcode scannen',
    stop: 'Camera stoppen',
    cameraDenied:
      'Geen toegang tot de camera — voer het barcodenummer zelf in.',
    manualLabel: 'Of voer het barcodenummer in',
    manualPlaceholder: '8710398160005',
    lookUp: 'Opzoeken',
  },

  detail: {
    notFound: 'Voedingsmiddel niet gevonden.',
    builtIn: 'Standaard',
    builtInNote:
      'Hoort bij de standaardlijst van gather en kan daarom niet worden bewerkt. Heb je een andere versie nodig?',
    createYourOwn: 'Maak je eigen voedingsmiddel',
    per100: 'per 100 {unit}',
    servings: 'Porties: {servings}',
    dataFrom: 'Voedingswaarde van',
    openFoodFacts: 'Open Food Facts',
    odbl: '(ODbL).',
    refresh: 'Vernieuwen vanaf Open Food Facts',
    refreshTitle: 'Vernieuwen vanaf Open Food Facts?',
    refreshBody:
      'Dit voedingsmiddel wordt overschreven met de nieuwste gegevens daar. Eigen aanpassingen gaan verloren.',
    refreshConfirm: 'Vernieuwen',
    refreshFailed: 'Kon niet vernieuwen vanaf Open Food Facts.',
  },

  form: {
    name: 'Naam',
    brand: 'Merk',
    barcode: 'Barcode: {barcode}',
    baseUnit: 'Basiseenheid',
    grams: 'gram',
    milliliters: 'milliliter',
    nutritionLegend: 'Voedingswaarde per 100 {unit}',
    servingsLegend: 'Porties',
    servingsHint:
      'Hoe je een portie hiervan noemt, en hoeveel {unit} dat is. Laat je dit leeg, dan worden de hoeveelheden die je noteert aangeboden.',
    servingLabel: 'Portieomschrijving',
    servingLabelPlaceholder: 'bijv. "1 plak"',
    servingAmount: 'Hoeveelheid ({unit})',
    removeServing: 'Deze portie verwijderen',
    save: 'Voedingsmiddel opslaan',
    saveFailed: 'Kon het voedingsmiddel niet opslaan',
  },

  create: {
    title: 'Voedingsmiddel toevoegen',
    lookingUp: 'Barcode opzoeken…',
    fromOff: 'Van Open Food Facts — controleer het voordat je opslaat.',
    offUnreachable:
      'Kon Open Food Facts niet bereiken — vul de gegevens zelf in.',
  },

  edit: {
    title: 'Voedingsmiddel bewerken',
    builtInBefore:
      'Dit hoort bij de standaardlijst van gather en kan niet worden bewerkt.',
    builtInAfter: 'als je een andere versie nodig hebt.',
  },
} satisfies typeof enFoods
