import type {
  TASTING_VOCABULARIES,
  TastingFieldKey,
  TastingKind,
  TastingUnit,
  TastingVocabularyId,
} from '../../tastings'

/**
 * Every word the three tasting Modules say.
 *
 * Keyed by the unions `tastings.ts` defines — the Kinds, the field keys, the
 * units, and every term of every vocabulary — so declaring a field or shipping
 * a term without naming it here is a typecheck failure rather than a chip
 * reading `undefined` (ADR-0011).
 *
 * **A subject's own name is never in here.** Comté is Comté in Dutch, and a
 * household's "Boerenkaas Remeker" is content somebody typed (story 30). What
 * is translated is the chrome around it: what the field is called, what the
 * shipped terms mean, and what the buttons do.
 */

/** What one Kind of thing is called, in the two places it is named. */
export const kinds = {
  cheese: {
    /** The thing itself: "Add a cheese", "No cheeses yet". */
    one: 'cheese',
    many: 'cheeses',
    /** The heading over the facts half of the composer. */
    facts: 'About the cheese',
    /** The composer's own title. */
    newTasting: 'New cheese tasting',
    /** The launcher row that starts one. */
    launcher: 'Cheese tasting',
    /** The catalog's heading in the subject picker. */
    catalogHeading: 'Well-known cheeses',
  },
  wine: {
    one: 'wine',
    many: 'wines',
    facts: 'About the bottle',
    newTasting: 'New wine tasting',
    launcher: 'Wine tasting',
    catalogHeading: 'Well-known wines',
  },
  beer: {
    one: 'beer',
    many: 'beers',
    facts: 'About the beer',
    newTasting: 'New beer tasting',
    launcher: 'Beer tasting',
    catalogHeading: 'Well-known beers',
  },
} satisfies Record<
  TastingKind,
  {
    one: string
    many: string
    facts: string
    newTasting: string
    launcher: string
    catalogHeading: string
  }
>

/** What each declared field is called. One word per key, shared across Kinds. */
export const fields = {
  milk: 'Milk',
  country: 'Country',
  style: 'Style',
  producer: 'Producer',
  brewery: 'Brewery',
  age: 'Age',
  vintage: 'Vintage',
  grapes: 'Grapes',
  region: 'Region',
  abv: 'ABV',
  firmness: 'Firmness',
  saltiness: 'Saltiness',
  sweetness: 'Sweetness',
  acidity: 'Acidity',
  tannin: 'Tannin',
  body: 'Body',
  bitterness: 'Bitterness',
  aromas: 'Aromas',
  notes: 'Notes',
} satisfies Record<TastingFieldKey, string>

export const units = {
  percent: '%',
  months: 'months',
} satisfies Record<TastingUnit, string>

type VocabularyMessages = {
  [V in TastingVocabularyId]: Record<
    (typeof TASTING_VOCABULARIES)[V][number],
    string
  >
}

export const vocabularies = {
  milkType: {
    cow: 'Cow',
    goat: 'Goat',
    sheep: 'Sheep',
    buffalo: 'Buffalo',
    mixed: 'Mixed',
  },
  cheeseCountry: {
    france: 'France',
    italy: 'Italy',
    netherlands: 'Netherlands',
    spain: 'Spain',
    switzerland: 'Switzerland',
    unitedKingdom: 'United Kingdom',
    ireland: 'Ireland',
    germany: 'Germany',
    belgium: 'Belgium',
    portugal: 'Portugal',
    greece: 'Greece',
    denmark: 'Denmark',
    sweden: 'Sweden',
    norway: 'Norway',
    austria: 'Austria',
    unitedStates: 'United States',
    other: 'Elsewhere',
  },
  cheeseStyle: {
    fresh: 'Fresh',
    soft: 'Soft',
    semiHard: 'Semi-hard',
    hard: 'Hard',
    blue: 'Blue',
  },
  cheeseAroma: {
    nutty: 'nutty',
    hay: 'hay',
    caramel: 'caramel',
    mushroom: 'mushroom',
    butter: 'butter',
    barnyard: 'barnyard',
    grassy: 'grassy',
    crystalline: 'crystalline',
    tangy: 'tangy',
    smoky: 'smoky',
    earthy: 'earthy',
    sharp: 'sharp',
  },
  grape: {
    nebbiolo: 'Nebbiolo',
    barbera: 'Barbera',
    dolcetto: 'Dolcetto',
    sangiovese: 'Sangiovese',
    cabernetSauvignon: 'Cabernet sauvignon',
    merlot: 'Merlot',
    syrah: 'Syrah',
    pinotNoir: 'Pinot noir',
    tempranillo: 'Tempranillo',
    grenache: 'Grenache',
    malbec: 'Malbec',
    chardonnay: 'Chardonnay',
    sauvignonBlanc: 'Sauvignon blanc',
    riesling: 'Riesling',
    cheninBlanc: 'Chenin blanc',
    pinotGris: 'Pinot gris',
    gewurztraminer: 'Gewürztraminer',
    viognier: 'Viognier',
    loureiro: 'Loureiro',
  },
  wineRegion: {
    bordeaux: 'Bordeaux',
    burgundy: 'Burgundy',
    champagne: 'Champagne',
    loire: 'Loire',
    rhone: 'Rhône',
    alsace: 'Alsace',
    beaujolais: 'Beaujolais',
    piedmont: 'Piedmont',
    tuscany: 'Tuscany',
    veneto: 'Veneto',
    sicily: 'Sicily',
    rioja: 'Rioja',
    riberaDelDuero: 'Ribera del Duero',
    priorat: 'Priorat',
    douro: 'Douro',
    alentejo: 'Alentejo',
    minho: 'Minho',
    mosel: 'Mosel',
    rheingau: 'Rheingau',
    wachau: 'Wachau',
    napaValley: 'Napa Valley',
    sonoma: 'Sonoma',
    willametteValley: 'Willamette Valley',
    marlborough: 'Marlborough',
    barossaValley: 'Barossa Valley',
    mendoza: 'Mendoza',
    stellenbosch: 'Stellenbosch',
    other: 'Elsewhere',
  },
  wineStyle: {
    red: 'Red',
    white: 'White',
    rose: 'Rosé',
    sparkling: 'Sparkling',
    sweet: 'Sweet',
    fortified: 'Fortified',
  },
  wineAroma: {
    cherry: 'cherry',
    blackcurrant: 'blackcurrant',
    plum: 'plum',
    citrus: 'citrus',
    pineapple: 'pineapple',
    peach: 'peach',
    apple: 'apple',
    violet: 'violet',
    rose: 'rose',
    leather: 'leather',
    tar: 'tar',
    tobacco: 'tobacco',
    vanilla: 'vanilla',
    oak: 'oak',
    smoke: 'smoke',
    pepper: 'pepper',
    herbal: 'herbal',
    honey: 'honey',
    butter: 'butter',
    mineral: 'mineral',
  },
  beerStyle: {
    pilsner: 'Pilsner',
    helles: 'Helles',
    weizen: 'Weissbier',
    witbier: 'Witbier',
    saison: 'Saison',
    tripel: 'Tripel',
    dubbel: 'Dubbel',
    quadrupel: 'Quadrupel',
    belgianStrongGolden: 'Belgian strong golden',
    paleAle: 'Pale ale',
    ipa: 'IPA',
    amberAle: 'Amber ale',
    brownAle: 'Brown ale',
    stout: 'Stout',
    porter: 'Porter',
    sour: 'Sour',
    lambic: 'Lambic',
    barleyWine: 'Barley wine',
    bock: 'Bock',
  },
  beerAroma: {
    banana: 'banana',
    clove: 'clove',
    citrus: 'citrus',
    pine: 'pine',
    resin: 'resin',
    caramel: 'caramel',
    chocolate: 'chocolate',
    coffee: 'coffee',
    roasted: 'roasted',
    honey: 'honey',
    bread: 'bread',
    floral: 'floral',
    herbal: 'herbal',
    tart: 'tart',
  },
} satisfies VocabularyMessages

/** The Module index: the list of everything the Group has tasted. */
export const index = {
  /** `{subjects}` and `{tastings}` are already-pluralized phrases. */
  summary: '{subjects} · {tastings}',
  subjectCount: { one: '{count} entry', other: '{count} entries' },
  tastingCount: { one: '{count} tasting', other: '{count} tastings' },
  search: 'Search',
  /** `{kind}` is the plural Kind noun. */
  searchEmpty: 'Nothing matching that.',
  clearSearch: 'Clear the search',
  add: 'Log a tasting',
  /** The average, read aloud. `{score}` is 4.3, `{count}` the number behind it. */
  averageOf: '{score} from {count}',
  /** Beside the stars, where the score itself is already drawn. */
  fromCount: 'from {count}',
  noScore: 'Not rated yet',
}

/** Nothing yet — one button that adds the first thing. */
export const empty = {
  /** `{kind}` is the plural noun: "No cheeses yet". */
  title: 'No {kind} yet',
  body: 'Rate one and it lands here, with everything {group} thinks of it.',
  /** `{kind}` is the singular noun: "Log a cheese". */
  action: 'Log a {kind}',
}

/** Choosing what you tasted, before the composer opens. */
export const picker = {
  title: 'Which {kind}?',
  search: 'Search or type a name',
  /** The heading over subjects this Group already has. `{group}` is its name. */
  mine: 'In {group}',
  /** `{name}` is what was typed. */
  create: 'Add “{name}”',
  createHint: 'A {kind} of your own, with your own facts',
  /**
   * Story 5, and deliberately a warning rather than a refusal: two Barolos
   * from two producers are two subjects, and only the person adding them knows
   * which case this is.
   */
  duplicate:
    'You already have {name}. Tap it to add another tasting, or carry on and make a second one.',
  back: 'Back to actions',
}

/** The composer: a subject's facts above the rule, one person's tasting below. */
export const composer = {
  myTasting: 'My tasting',
  /** The subject's own name — the one field the composer always draws. */
  name: 'Name',
  score: 'Score',
  /** VoiceOver's name for one star. `{value}` is 0.5 – 5. */
  scoreValue: '{value} out of 5',
  tastedAt: 'Tasted',
  today: 'Today',
  yesterday: 'Yesterday',
  earlierDay: 'A day earlier',
  laterDay: 'A day later',
  notesPlaceholder: 'What did it taste of?',
  addYourOwn: 'Add your own',
  addTerm: 'Add “{name}”',
  choose: 'Choose',
  none: 'Not set',
  clear: 'Clear',
  save: 'Save',
  saveEdit: 'Save changes',
  cancel: 'Cancel',
  /** Shown under the name in the composer's subject row. */
  fromCatalog: 'From the list',
  newHere: 'New in {group}',
  existing: '{count} tasting so far',
  existingOther: '{count} tastings so far',
  /** The refusal keys `validateTastingAttributes` reports. */
  problems: {
    unknownField: 'That field is not part of this form.',
    wrongType: 'That is not a value this field can hold.',
    notInVocabulary: 'Pick one of the options offered.',
    outOfRange: 'That number is outside what this field allows.',
    tooLong: 'That is too long.',
    tooMany: 'That is too many.',
    needsName: 'Give it a name first.',
    needsScore: 'Give it a score first.',
  },
}

/** One subject's page: its facts, its photo, and the household's history. */
export const subject = {
  facts: 'Facts',
  tastings: 'Tastings',
  noTastings: 'Nobody has tasted this yet.',
  logTasting: 'Log a tasting',
  addPhoto: 'Label',
  photoOf: 'Photo of {name}',
  photoUploading: 'Adding the photo…',
  photoFailed: 'That photo could not be added.',
  photoDenied: 'Gather needs permission to use that.',
  takePhoto: 'Take a photo',
  choosePhoto: 'Choose a photo',
  replacePhoto: 'Replace',
  removePhoto: 'Remove',
  /** Attribution on a Tasting row. */
  you: 'You',
  edit: 'Edit',
  editSubject: 'Edit the facts',
  delete: 'Delete',
  deleteTasting: 'Delete this tasting',
  /**
   * Permanent, and it says how much (story 22). gather deletes for good — no
   * archive, no undo — so this is the confirm half of confirm-or-undo.
   */
  deleteSubjectTitle: 'Delete {name}?',
  deleteSubjectBody: {
    one: 'This also deletes {count} tasting, including other people’s.',
    other: 'This also deletes {count} tastings, including other people’s.',
  },
  deleteSubjectBodyEmpty: 'Nothing has been tasted against it yet.',
  deleteTastingTitle: 'Delete this tasting?',
  deleteTastingBody: 'It will not be possible to get it back.',
  /** Story 18: nobody edits words that appear under somebody else's name. */
  notYours: 'Only {name} can change their own tasting.',
}

export const tastings = {
  kinds,
  fields,
  units,
  vocabularies,
  index,
  empty,
  picker,
  composer,
  subject,
}
