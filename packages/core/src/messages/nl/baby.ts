import type {
  baby as enBaby,
  eventTypes as enEventTypes,
  log as enLog,
} from '../en/baby'

export const eventTypes = {
  temperature: 'Temperatuur',
  feeding: 'Voeding',
  diaper: 'Luier',
  sleep: 'Slaap',
  growth: 'Groei',
  medication: 'Medicatie',
  vaccination: 'Vaccinatie',
  note: 'Notitie',
} satisfies typeof enEventTypes

export const log = {
  list: {
    subtitle:
      'Temperatuur, voeding, slaap, groei en meer — gedeeld met de Groep.',
    addChild: 'Kind toevoegen',
    emptyTitle: 'Nog geen kinderen',
    emptyBody:
      'Voeg een kind toe om temperatuur, voeding, slaap en meer bij te houden.',
    emptyAction: 'Voeg je eerste kind toe',
  },

  child: {
    age: {
      days: { one: '{count} dag oud', other: '{count} dagen oud' },
      weeks: { one: '{count} week oud', other: '{count} weken oud' },
      months: { one: '{count} maand oud', other: '{count} maanden oud' },
      years: { one: '{count} jaar oud', other: '{count} jaar oud' },
      yearsMonths: '{years}j {months}m oud',
    },
    notFound: 'Kind niet gevonden.',
    switch: 'Ander kind kiezen',
    todo: 'Te doen',
    todoPlaceholder: 'Luiers kopen, consultatiebureau bellen…',
    questions: 'Vragen',
    questionsPlaceholder: 'Vragen over de slaapregressie…',
    addTo: 'Toevoegen aan {list}',
    deleteTask: '{task} verwijderen',
    temperatureTrend: 'Verloop temperatuur',
    weightTrend: 'Verloop gewicht',
    checklistEmpty: 'Niets te doen — mooi.',
    trendEmpty: 'Noteer minstens twee keer om een lijn te zien.',
    trendChart: 'Verloopgrafiek, {unit}, {count} punten',
  },

  form: {
    name: 'Naam',
    birthDate: 'Geboortedatum',
    sex: 'Geslacht',
    sexUnspecified: 'Zeg ik liever niet',
    sexFemale: 'Meisje',
    sexMale: 'Jongen',
    saveFailed: 'Kon dat kind niet opslaan',
    createTitle: 'Een kind toevoegen',
    editTitle: '{name} bewerken',
    deleteTitle: '{name} verwijderen?',
    deleteBody:
      'Alles wat voor dit kind is genoteerd gaat mee, voor iedereen in deze Groep.',
    deleteConfirm: '{name} verwijderen',
    deleteFailed: 'Kon dat kind niet verwijderen.',
  },

  quickLog: {
    heading: 'Iets noteren',
    several: 'Meerdere noteren',
  },

  entry: {
    logTitle: '{type} noteren',
    editTitle: '{type} bewerken',
    when: 'Wanneer',
    start: 'Begin',
    notes: 'Notities',
    saveFailed: 'Kon deze notitie niet opslaan',
  },

  multi: {
    heading: 'Meerdere dingen noteren',
    when: 'Wanneer',
    include: 'Noteer',
    pickOne: 'Kies minstens één ding om te noteren.',
    save: {
      one: '{count} notitie opslaan',
      other: '{count} notities opslaan',
    },
    partial: '{saved} van {total} opgeslagen — {detail}',
  },

  timeline: {
    empty: 'Nog niets genoteerd — noteer hierboven het eerste.',
    deleteEntry: '{type} verwijderen',
    deleteTitle: 'Deze notitie verwijderen?',
    deleteConfirm: 'Verwijderen',
    deleteFailed: 'Kon die notitie niet verwijderen.',
  },

  fields: {
    temperature: 'Temperatuur (°C)',
    method: 'Manier',
    notSpecified: 'Niet opgegeven',
    leftMin: 'Links (min)',
    rightMin: 'Rechts (min)',
    amountMl: 'Hoeveelheid (ml)',
    end: 'Einde (optioneel)',
    kind: 'Soort',
    weightKg: 'Gewicht (kg)',
    heightCm: 'Lengte (cm)',
    headCm: 'Hoofdomtrek (cm)',
    medicationName: 'Naam',
    doseAmount: 'Dosis',
    doseUnit: 'Eenheid',
    doseUnitPlaceholder: 'ml, mg…',
    vaccineName: 'Naam van het vaccin',
    milestone: 'Markeren als mijlpaal',
  },

  options: {
    temperatureMethod: {
      oral: 'Oraal',
      rectal: 'Rectaal',
      axillary: 'Oksel',
      ear: 'Oor',
      forehead: 'Voorhoofd',
    },
    feedingMethod: {
      breast: 'Borstvoeding',
      bottle: 'Fles',
      solid: 'Vast voedsel',
    },
    feedingSide: {
      left: 'Links',
      right: 'Rechts',
      both: 'Beide',
    },
    diaperKind: {
      wet: 'Nat',
      dirty: 'Vies',
      both: 'Beide',
    },
  },

  validation: {
    negativeMinutes: 'Minuten kunnen niet negatief zijn',
    selectTemperature: 'Kies een temperatuur',
    enterMeasurement: 'Vul minstens één meting in',
    enterMedicationName: 'Vul een naam van het medicijn in',
    enterVaccineName: 'Vul een naam van het vaccin in',
  },

  summary: {
    celsiusWithMethod: '{celsius}°C ({method})',
    celsius: '{celsius}°C',
    sideMinutes: '{side} {minutes}m',
    diaper: {
      wet: 'Natte luier',
      dirty: 'Vieze luier',
      both: 'Natte en vieze luier',
    },
    sleepFor: 'Slaap · {duration}',
    sleep: 'Slaap',
    headCircumference: 'hoofd {value} cm',
    growth: 'Groeimeting',
    medication: 'Medicatie',
    vaccination: 'Vaccinatie',
    milestone: 'Mijlpaal',
    note: 'Notitie',
  },

  pdf: {
    title: '{name} — babylogboek',
    born: 'Geboren {date} · {age}',
    columnDate: 'Datum',
    columnTime: 'Tijd',
    columnDetails: 'Details',
    columnEntries: 'Notities',
    columnNotes: 'Opmerkingen',
    empty: 'Geen notities in deze periode.',
    fileNameFallback: 'baby',
  },

  export: {
    button: 'PDF exporteren',
    title: 'PDF exporteren',
    from: 'Van',
    to: 'Tot',
    layout: 'Indeling',
    byCategory: 'Per categorie',
    chronological: 'Chronologisch',
    include: 'Neem mee',
    download: 'PDF downloaden',
    generating: 'Genereren…',
    failed: 'Kon de PDF niet maken',
  },
} satisfies typeof enLog

export const baby = { eventTypes, log } satisfies typeof enBaby
