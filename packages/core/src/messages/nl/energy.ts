import type { Messages } from '../en'

export const energy = {
  empty: {
    summary: 'Nog geen adres',
    sub: 'Verbruik, kosten en prijzen per uur',
    title: 'Wat kost jullie stroom, elk uur?',
    body: 'Zie wat het huis verbruikt, opwekt en betaalt, met de prijs van elk uur. Ook voor zonnepanelen en een thuisbatterij.',
    next: 'Begin met je adres. Daarna koppel je Home Assistant of typ je meterstanden.',
    action: 'Voeg je adres toe',
  },
  form: {
    addressHeading: 'Adres',
    name: 'Naam',
    defaultName: 'Thuis',
    house: 'Huis',
    houseNone: 'Geen (optioneel)',
    houseHint:
      'Koppel aan een huis uit Financiën om energie naast je hypotheek te zien. Niet nodig.',
    sourceHeading: 'Hoe komt je data binnen?',
    sourceLabel: 'Bron',
    homeAssistant: 'Home Assistant koppelen',
    homeAssistantHint:
      'Per uur, met zon en batterij. Ook HomeWizard en Zonneplan die in Home Assistant staan.',
    manual: 'Meterstanden typen',
    manualHint: 'Per dag geschat. Goed om mee te beginnen.',
    submit: 'Verder',
    saving: 'Bewaren…',
  },
  site: {
    sourceNone: 'Nog geen bron gekoppeld',
    sourceManual: 'Meterstanden',
    manualSourceLabel: 'Meterstanden',
    nextTitle: 'Binnenkort',
    nextHomeAssistant:
      'Home Assistant koppelen komt binnenkort in een update. Tot dan heeft dit adres nog geen verbruik.',
    nextManual:
      'Meterstanden typen komt binnenkort in een update. Tot dan heeft dit adres nog geen verbruik.',
  },
  refusals: {
    needsName: 'Geef het adres een naam.',
    tooLong: 'Die naam is te lang.',
    houseNotFound: 'Dat huis hoort niet meer bij deze Groep.',
    notFound: 'Dat adres hoort niet bij deze Groep.',
  },
} satisfies Messages['energy']
