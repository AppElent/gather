/**
 * Whether a recipe clashes with a Group's meal preferences.
 *
 * **How it knows.** It reads the recipe's own words: its title and its
 * ingredient lines, matched against a keyword dictionary in Dutch and English
 * per allergen and per diet. Recipe tags only ever *add* certainty for a diet
 * ("vegetarisch" on a recipe with no ingredients listed); a tag never clears a
 * keyword that was found.
 *
 * **What it never claims.** An empty result means "nothing recognisable
 * clashes", not "free of". When the recipe has no ingredients, or names
 * something that often hides an allergen (stock, pesto, a dressing), the
 * result carries an `uncertain` entry, which the screen shows as "controleer
 * zelf" / "check yourself" and never hides. Only entries without `uncertain`
 * hide a recipe.
 *
 * Text is compared lower-cased with accents removed. A `part` term matches
 * inside a word, because Dutch writes compounds ("pindakaas", "kippendijen");
 * a `word` term matches only a whole word ("ei" must not match "prei"). Before
 * matching, each rule's `except` phrases are blanked out of the line, so
 * "kokosmelk" is not milk and "nootmuskaat" is not a nut.
 */
import { fmt } from './i18n'
import type {
  Allergen,
  Diet,
  ResolvedMealPreferences,
} from './mealPreferences'
import type { Messages } from './messages/en'

export interface MatchableRecipe {
  title: string
  ingredients: readonly string[]
  tags: readonly string[]
  prepMinutes?: number
}

export type RecipeClash =
  | {
      kind: 'allergen'
      id: Allergen
      /** The recipe's own word that matched, or the allergen id when unsure for lack of ingredients. */
      label: string
      uncertain?: boolean
    }
  | {
      kind: 'diet'
      id: Diet
      label: string
      uncertain?: boolean
    }
  | { kind: 'dislike'; label: string; uncertain?: undefined }
  | {
      kind: 'time'
      /** "45 min". */
      label: string
      minutes: number
      limit: number
      uncertain?: undefined
    }

interface Rule {
  /** Match inside a word. */
  part?: readonly string[]
  /** Match a whole word (or a multi-word phrase on word boundaries). */
  word?: readonly string[]
  /** Blanked out of a line before matching. */
  except?: readonly string[]
  /** Often hides it: an `uncertain` entry, never a hide. */
  maybe?: readonly string[]
  /** A line with one of these is left alone ("vegetarisch gehakt"). */
  lineGuard?: readonly string[]
}

// ---------------------------------------------------------------------------
// Dictionary. Normalised: lower case, no accents, letters and spaces only.

const GLUTEN: Rule = {
  part: [
    'tarwe',
    'wheat',
    'gerst',
    'barley',
    'rogge',
    'spelt',
    'kamut',
    'havermout',
    'bloem',
    'flour',
    'paneermeel',
    'griesmeel',
    'semolina',
    'volkorenmeel',
    'pasta',
    'spaghetti',
    'macaroni',
    'penne',
    'fusilli',
    'tagliatelle',
    'linguine',
    'lasagne',
    'lasagna',
    'ravioli',
    'tortellini',
    'orzo',
    'noedel',
    'noodle',
    'brood',
    'bread',
    'broodkruim',
    'breadcrumb',
    'panko',
    'couscous',
    'bulgur',
    'seitan',
    'croissant',
    'crouton',
    'pita',
    'naan',
    'pizza',
    'bladerdeeg',
    'filodeeg',
    'pastry',
    'bier',
    'beer',
    'cracker',
    'beschuit',
    'haver',
    'boterham',
    'tosti',
    'taart',
    'bakmeel',
    'tarwemeel',
    'ciabatta',
    'baguette',
    'focaccia',
    'brioche',
    'bagel',
    'udon',
    'ramennoedel',
    'lange vinger',
    'ladyfinger',
    'speculaas',
    'speculoos',
    'koek',
    'cake',
    'cookie',
    'biscuit',
    'muffin',
    'wafel',
    'waffle',
    'crumble',
    'cannelloni',
    'farfalle',
    'rigatoni',
    'pappardelle',
    'tortelloni',
    'conchiglie',
    'vermicelli',
  ],
  word: [
    'oat',
    'oats',
    'wrap',
    'wraps',
    'deeg',
    'dough',
    'mie',
    'roti',
    'ramen',
    'toast',
    'toasts',
    'toastje',
    'toastjes',
  ],
  except: [
    'bloemkool',
    'maisbloem',
    'maizena',
    'rijstebloem',
    'rijstbloem',
    'rijstnoedel',
    'tomatenpasta',
    'currypasta',
    'kerriepasta',
    'misopasta',
    'sesampasta',
    'gemberpasta',
    'knoflookpasta',
    'pindapasta',
    'chilipasta',
    'tandpasta',
    'cornflour',
    'corn flour',
    'rice flour',
    'almond flour',
    'coconut flour',
    'chickpea flour',
    'buckwheat',
    'rijstvermicelli',
    'rice noodle',
    'glasnoedel',
    'glass noodle',
    'kikkererwtenbloem',
    'amandelbloem',
    'boekweit',
    'buckwheat',
    'gemberbier',
    'ginger beer',
    'broodbeleg',
    'rijstwafel',
    'rijstkoek',
    'maiswafel',
    'mais wafel',
    'rice cake',
    'rice vermicelli',
    'rijst vermicelli',
    'koekenpan',
    'koekepan',
    'cakevorm',
    'cakeblik',
    'cake tin',
    'cake pan',
    'cookie cutter',
    'koekjesvorm',
    'koekjes vorm',
    'speculaaskruiden',
    'koekkruiden',
  ],
  maybe: [
    'meel',
    'soba',
    'sojasaus',
    'soy sauce',
    'ketjap',
    'bouillon',
    'stock',
    'worcestershire',
    'gnocchi',
    'tortilla',
    'taco',
    'paneer',
  ],
  lineGuard: ['glutenvrij', 'gluten free', 'glutenvrije'],
}

const CRUSTACEANS: Rule = {
  part: [
    'garnaal',
    'garnalen',
    'shrimp',
    'prawn',
    'kreeft',
    'lobster',
    'krab',
    'crab',
    'langoustine',
    'scampi',
    'gamba',
    'kreeftje',
    'crayfish',
    'shellfish',
    'schaaldier',
  ],
  maybe: ['surimi', 'kroepoek', 'paella', 'zeevruchten', 'seafood'],
}

const EGGS: Rule = {
  part: [
    'eier',
    'eitje',
    'kippenei',
    'scharrelei',
    'eendenei',
    'kwartelei',
    'eidooier',
    'eigeel',
    'eiwit',
    'mayonaise',
    'mayonnaise',
    'aioli',
    'meringue',
    'omelet',
    'frittata',
    'quiche',
    'hollandaise',
    'bearnaise',
    'scrambled',
  ],
  word: ['ei', 'egg', 'eggs', 'mayo', 'egg yolk', 'egg white'],
  except: ['eiwitrijk', 'eggplant'],
  maybe: ['mie', 'verse pasta', 'fresh pasta', 'tagliatelle', 'pannenkoek', 'pancake', 'cake'],
}

const FISH: Rule = {
  part: [
    'zalm',
    'salmon',
    'tonijn',
    'tuna',
    'kabeljauw',
    'makreel',
    'mackerel',
    'haring',
    'herring',
    'ansjovis',
    'anchov',
    'sardine',
    'sardien',
    'forel',
    'trout',
    'pangasius',
    'tilapia',
    'koolvis',
    'heilbot',
    'halibut',
    'zeebaars',
    'dorade',
    'kibbeling',
    'lekkerbek',
    'vissaus',
    'fish',
    'visfilet',
    'vissoep',
    'visstick',
    'visbouillon',
    'surimi',
    'schelvis',
    'wijting',
    'vis',
    'schol',
    'baars',
    'snoek',
    'paling',
    'zeeduivel',
    'tongfilet',
    'zeetong',
    'tongschar',
    'tarbot',
    'bokking',
    'sprot',
    'pollak',
    'zeewolf',
    'skrei',
    'bacalhau',
    'sole fillet',
  ],
  word: ['cod', 'tong', 'sole', 'bass', 'pike', 'eel'],
  except: [
    'inktvis',
    'shellfish',
    'visite',
    'televisie',
    'provisie',
    'runder tong',
    'kalfs tong',
    'ossen tong',
    'varkens tong',
    'beef tongue',
  ],
  maybe: ['worcestershire', 'caesar', 'dashi', 'paella', 'zeevruchten', 'seafood'],
}

const PEANUTS: Rule = {
  part: ['pinda', 'peanut', 'satesaus', 'arachide', 'apenoot', 'groundnut'],
  word: ['sate', 'satay'],
  maybe: ['gado gado', 'pad thai'],
}

const SOY: Rule = {
  part: [
    'soja',
    'soy',
    'tofu',
    'tempeh',
    'edamame',
    'miso',
    'ketjap',
    'shoyu',
    'tamari',
  ],
  except: ['sojascheut'],
  maybe: ['teriyaki', 'hoisin'],
}

const MILK_EXCEPT = [
  'boterham',
  'gemalen ijs',
  'crushed ice',
  'ijsbergsla',
  'ijsblokje',
  'ijsklontje',
  'ijswater',
  'ijskoud',
  'waterijs',
  'kokosmelk',
  'amandelmelk',
  'havermelk',
  'sojamelk',
  'rijstmelk',
  'notenmelk',
  'cashewmelk',
  'kokosroom',
  'coconut milk',
  'coconut cream',
  'almond milk',
  'oat milk',
  'soy milk',
  'rice milk',
  'pindakaas',
  'peanut butter',
  'nut butter',
  'notenboter',
  'amandelboter',
  'cacaoboter',
  'cocoa butter',
  'butternut',
  'mushroom',
  'cream of tartar',
  'wijnsteen',
  'sojayoghurt',
  'kokosyoghurt',
  'haveryoghurt',
  'coconut yogurt',
  'coconut yoghurt',
]

const MILK: Rule = {
  part: [
    'melk',
    'ice cream',
    'roomijs',
    'vanilleijs',
    'chocoladeijs',
    'aardbeienijs',
    'ijstaart',
    'schepijs',
    'softijs',
    'milk',
    'room',
    'boter',
    'butter',
    'kaas',
    'cheese',
    'yoghurt',
    'yogurt',
    'kwark',
    'creme fraiche',
    'cream',
    'mozzarella',
    'parmezaan',
    'parmesan',
    'parmigiano',
    'pecorino',
    'feta',
    'ricotta',
    'mascarpone',
    'burrata',
    'gorgonzola',
    'cheddar',
    'brie',
    'camembert',
    'halloumi',
    'paneer',
    'ghee',
    'whey',
    'lactose',
    'kefir',
    'zuivel',
    'dairy',
    'custard',
  ],
  word: ['wei', 'vla', 'ijs', 'ijsje', 'ijsjes'],
  except: MILK_EXCEPT,
  maybe: ['pesto', 'bechamel', 'puree'],
}

const NUTS: Rule = {
  part: [
    'noot',
    'amaretti',
    'noten',
    'nut',
    'amandel',
    'almond',
    'hazelnut',
    'walnut',
    'cashew',
    'pecan',
    'pistache',
    'pistachio',
    'macadamia',
    'marsepein',
    'marzipan',
    'praline',
    'frangipane',
    'nutella',
    'gianduja',
  ],
  except: [
    'nootmuskaat',
    'muskaatnoot',
    'nutmeg',
    'kokosnoot',
    'kokos',
    'coconut',
    'butternut',
    'peanut',
    'pindanoot',
    'pindanoten',
    'doughnut',
    'donut',
    'minuut',
    'minuten',
    'minute',
    'chestnut',
    'nutrition',
    'nutritional',
  ],
  maybe: ['pesto', 'granola', 'muesli', 'dukkah'],
}

const CELERY: Rule = {
  part: ['selderij', 'selder', 'celery', 'celeriac'],
  maybe: ['bouillon', 'stock', 'soepgroente', 'soup greens', 'soepbasis'],
}

const MUSTARD: Rule = {
  part: ['mosterd', 'mustard', 'dijon'],
  maybe: ['mayonaise', 'mayonnaise', 'vinaigrette', 'dressing', 'curry'],
}

const SESAME: Rule = {
  part: ['sesam', 'sesame', 'tahin', 'hummus', 'hoummos', 'houmous', 'gomasio'],
  maybe: ['zaatar', 'dukkah', 'falafel'],
}

const SULPHITES: Rule = {
  part: [
    'wijn',
    'wine',
    'sulfiet',
    'sulfite',
    'sulphite',
    'sherry',
    'cider',
  ],
  word: ['port'],
  maybe: ['azijn', 'vinegar', 'rozijn', 'raisin', 'gedroogde abrikoz', 'dried apricot'],
}

const LUPIN: Rule = { part: ['lupine', 'lupin'] }

const MOLLUSCS: Rule = {
  part: [
    'mossel',
    'mussel',
    'oester',
    'oyster',
    'inktvis',
    'calamar',
    'squid',
    'octopus',
    'jakobsschelp',
    'scallop',
    'kokkel',
    'cockle',
    'clam',
    'venusschelp',
    'vongole',
    'schelpdier',
    'sint jakobsschelp',
    'zeeoor',
    'abalone',
    'escargot',
    'wulk',
    'whelk',
  ],
  word: ['slak', 'slakken', 'snail', 'snails'],
  maybe: ['zeevruchten', 'seafood', 'paella'],
}

export const ALLERGEN_RULES: Record<Allergen, Rule> = {
  gluten: GLUTEN,
  crustaceans: CRUSTACEANS,
  eggs: EGGS,
  fish: FISH,
  peanuts: PEANUTS,
  soy: SOY,
  milk: MILK,
  nuts: NUTS,
  celery: CELERY,
  mustard: MUSTARD,
  sesame: SESAME,
  sulphites: SULPHITES,
  lupin: LUPIN,
  molluscs: MOLLUSCS,
}

const VEG_GUARD = [
  'vega',
  'vegetari',
  'veggie',
  'plantaardig',
  'plant based',
  'meatless',
  'vleesvervang',
  'vleesloos',
]

const PORK = [
  'half om half gehakt',
  'varken',
  'pork',
  'spek',
  'bacon',
  'chorizo',
  'salami',
  'pancetta',
  'prosciutto',
  'serrano',
  'reuzel',
  'lardo',
  'guanciale',
  'speklap',
  'hamlap',
  'frikandel',
]

const MEAT: Rule = {
  part: [
    'vlees',
    'meat',
    'gehaktbal',
    'mince',
    'kip',
    'chicken',
    'kalkoen',
    'turkey',
    'rund',
    'beef',
    'biefstuk',
    'steak',
    'ossenstaart',
    'kalfs',
    'veal',
    'lams',
    'lamb',
    'eend',
    'duck',
    'konijn',
    'rabbit',
    'fazant',
    'hert',
    'worst',
    'sausage',
    'hamburger',
    'pastrami',
    'shoarma',
    'gyros',
    'doner',
    'kebab',
    'gelatine',
    'gelatin',
    'lever',
    'liver',
    'schnitzel',
    'ossenhaas',
    'varkenshaas',
    'kogelbiefstuk',
    'karbonade',
    'kotelet',
    'entrecote',
    'sparerib',
    'spare rib',
    'ribeye',
    'rib eye',
    'tournedos',
    'ossobuco',
    'riblap',
    'sukadelap',
    'sukadevlees',
    'rosbief',
    'roast beef',
    'rundercarpaccio',
    'beef carpaccio',
    'cordon bleu',
    'saucijs',
    'merguez',
    'drumstick',
    'bitterbal',
    'filet americain',
    'zwijn',
    'wildstoof',
    'wildragout',
    'wildpate',
    'hertenvlees',
    'struisvogel',
    ...PORK,
  ],
  word: ['ham', 'lam', 'haas', 'gans', 'lard', 'gehakt', 'ree', 'mergpijp'],
  except: [
    'vleestomaat',
    'vleestomaten',
    'vruchtvlees',
    'kokosvlees',
    'coconut meat',
    'bloemkoolsteak',
    'tofu steak',
    'kippenei',
    'hertshoorn',
    'selderijschnitzel',
    'bloemkoolschnitzel',
    'tofuschnitzel',
    'groenteschnitzel',
    'seitanschnitzel',
    'wild rice',
    'wilde rijst',
    'serrano peper',
    'serranopeper',
    'serrano pepper',
    'serrano chili',
    'spekkoek',
    ', gehakt',
    'fijn gehakt',
    'grof gehakt',
    'fijngehakt',
    'grofgehakt',
  ],
  maybe: ['bouillon', 'stock', 'burger', 'kroket', 'fond', 'jus', 'carpaccio'],
  lineGuard: VEG_GUARD,
}

const SEAFOOD: Rule = {
  part: [
    ...(FISH.part ?? []),
    ...(CRUSTACEANS.part ?? []),
    ...(MOLLUSCS.part ?? []),
  ],
  word: [...(FISH.word ?? []), ...(MOLLUSCS.word ?? [])],
  maybe: ['worcestershire', 'dashi', 'zeevruchten', 'seafood'],
  lineGuard: VEG_GUARD,
}

const ANIMAL_OTHER: Rule = {
  part: [...(MILK.part ?? []), ...(EGGS.part ?? []), 'honing', 'honey'],
  word: [...(MILK.word ?? []), ...(EGGS.word ?? [])],
  except: [...MILK_EXCEPT, 'eiwitrijk', 'eggplant'],
  maybe: ['pesto', 'mie', 'verse pasta', 'fresh pasta'],
  lineGuard: ['vegan', 'plantaardig', 'plant based', 'zuivelvrij', 'dairy free'],
}

const ALCOHOL = [
  'wijn',
  'wine',
  'bier',
  'beer',
  'rum',
  'cognac',
  'brandy',
  'whisky',
  'whiskey',
  'vodka',
  'sherry',
  'likeur',
  'liqueur',
  'amaretto',
  'calvados',
  'cider',
  'marsala',
]

const HALAL: Rule = {
  part: [...PORK, ...ALCOHOL.filter((term) => term.length > 3)],
  word: ['ham', 'rum', 'gin', 'port', 'lard'],
  except: [
    'wijnazijn',
    'wine vinegar',
    'portobello',
    'gemberbier',
    'ginger beer',
    'serrano peper',
    'serranopeper',
    'serrano pepper',
    'serrano chili',
    'spekkoek',
  ],
  maybe: ['half om half', 'gelatine', 'gelatin', 'mirin', 'wijnazijn', 'wine vinegar'],
  lineGuard: ['halal'],
}

/** Meat whose slaughter the recipe cannot say: "controleer zelf" for halal. */
const HALAL_UNSURE_MEAT: Rule = {
  part: (MEAT.part ?? []).filter((term) => !PORK.includes(term)),
  word: ['lam', 'haas', 'gans', 'gehakt', 'ree', 'mergpijp'],
  except: MEAT.except,
  lineGuard: [...VEG_GUARD, 'halal'],
}

const DIET_RULES: Record<Diet, { clash: Rule[]; unsure?: Rule[]; tags: string[] }> = {
  vegetarian: {
    clash: [MEAT, SEAFOOD],
    tags: ['vegetarisch', 'vegetarian', 'vega', 'veggie', 'vegan', 'veganistisch'],
  },
  vegan: {
    clash: [MEAT, SEAFOOD, ANIMAL_OTHER],
    tags: ['vegan', 'veganistisch', 'plantaardig', 'plant based'],
  },
  pescatarian: {
    clash: [MEAT],
    tags: [
      'pescotarisch',
      'pescatarisch',
      'pescatarian',
      'vegetarisch',
      'vegetarian',
      'vega',
      'vegan',
      'veganistisch',
    ],
  },
  'gluten-free': {
    clash: [GLUTEN],
    tags: ['glutenvrij', 'gluten free', 'glutenfree'],
  },
  'lactose-free': {
    clash: [
      {
        ...MILK,
        lineGuard: ['lactosevrij', 'lactose free', 'lactosevrije', 'zuivelvrij', 'dairy free'],
      },
    ],
    tags: ['lactosevrij', 'lactose free', 'zuivelvrij', 'dairy free', 'vegan', 'veganistisch'],
  },
  halal: {
    clash: [HALAL],
    unsure: [HALAL_UNSURE_MEAT],
    tags: ['halal'],
  },
}

// ---------------------------------------------------------------------------
// Matching

/** Lower case, accents removed, anything but letters, digits and commas a space. */
export function normalizeText(text: string): string {
  return ` ${text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // A comma stays, as its own word: "ui, gehakt" is chopped onion, and only
    // the comma says so.
    .replace(/,/g, ' , ')
    .replace(/[^a-z0-9,]+/g, ' ')
    .trim()} `
}

function blank(line: string, phrases: readonly string[] | undefined): string {
  let out = line
  for (const phrase of phrases ?? []) {
    if (out.includes(phrase)) out = out.split(phrase).join(' ')
  }
  return out
}

/** The first term of `rule` in this normalised line, with the word it sits in. */
function findTerm(
  line: string,
  part: readonly string[] | undefined,
  word: readonly string[] | undefined,
): string | null {
  for (const term of word ?? []) {
    if (line.includes(` ${term} `)) return term
  }
  for (const term of part ?? []) {
    const at = line.indexOf(term)
    if (at === -1) continue
    // The whole word it was found in, as the recipe wrote it (normalised).
    const start = line.lastIndexOf(' ', at) + 1
    const end = line.indexOf(' ', at + term.length)
    return line.slice(start, end === -1 ? undefined : end)
  }
  return null
}

/** Whether every word of `part` belongs to a free-from word ("glutenvrije"). */
function isOnlyGuard(part: string, guards: readonly string[]): boolean {
  let rest = part
  for (const guard of [...guards].sort((a, b) => b.length - a.length)) {
    rest = rest.replace(new RegExp(`\\S*${guard}\\S*`, 'g'), ' ')
  }
  return rest.trim() === ''
}

interface RuleHit {
  term: string
  uncertain: boolean
}

function matchRule(lines: readonly string[], rule: Rule): RuleHit | null {
  let maybe: string | null = null
  for (const raw of lines) {
    // A guard word in front of a term names the safe variant ("vegetarisch
    // gehakt", "glutenvrije pasta", "halal kipfilet"): no clash. Anywhere
    // else it is a choice or a tip ("bloem (of glutenvrij meel)", "spaghetti
    // (eventueel glutenvrij)", "kipfilets (vegetariers: gebruik tofu)"), so
    // what the line names may still be what is cooked: "controleer zelf",
    // never silence. Each item ("pasta en bloem") and alternative ("kip of
    // tofu") is read on its own, so a guard only clears its own term.
    const guards = rule.lineGuard ?? []
    const lineGuarded = guards.some((guard) => raw.includes(guard))
    // A piece that is nothing but a free-from word ("pasta, glutenvrij",
    // "kipfilet, halal") qualifies the item before it.
    const found: { term: string; open: boolean }[] = []
    for (const piece of blank(raw, rule.except).split(
      / (?:of|or|en|and) |,/,
    )) {
      const part = ` ${piece.trim()} `
      if (part.trim() && isOnlyGuard(part, guards)) {
        const last = found.at(-1)
        if (last) last.open = false
        continue
      }
      const hit = findTerm(part, rule.part, rule.word)
      if (!hit) continue
      const hitAt = part.indexOf(hit)
      const guardAt = Math.min(
        ...guards.map((guard) => part.indexOf(guard)).filter((at) => at >= 0),
      )
      found.push({ term: hit, open: guardAt > hitAt })
    }
    const open = found.find((entry) => entry.open)?.term ?? null
    const cleared = found.length > 0
    if (open && !lineGuarded) return { term: open, uncertain: false }
    if (open) {
      maybe ??= open
      continue
    }
    if (cleared) continue
    // Read the line as written: "wijnazijn" is blanked as wine for halal and
    // still worth a "controleer zelf". A maybe sits inside a compound too
    // ("groentebouillon") when it is long enough not to match by accident.
    maybe ??= findTerm(
      raw,
      rule.maybe?.filter((term) => term.length >= 5),
      rule.maybe,
    )
  }
  return maybe ? { term: maybe, uncertain: true } : null
}

/** Forms of a dislike to look for: as typed, and without a plural ending. */
function dislikeForms(dislike: string): string[] {
  const base = normalizeText(dislike).trim()
  if (!base) return []
  const forms = [base]
  if (base.endsWith('en') && base.length > 5) forms.push(base.slice(0, -2))
  else if (base.endsWith('s') && base.length > 4) forms.push(base.slice(0, -1))
  return forms
}

/**
 * Everything about this recipe that goes against the Group's preferences on
 * this weekday (0 is Monday). Empty means nothing recognisable clashes.
 *
 * Entries with `uncertain` are "controleer zelf": show them, never hide on
 * them. `fitsPreferences` is the hide test.
 */
export function recipeClashes(
  recipe: MatchableRecipe,
  prefs: Pick<
    ResolvedMealPreferences,
    'allergens' | 'diets' | 'dislikes' | 'cookingMinutes'
  >,
  weekday: number,
): readonly RecipeClash[] {
  const clashes: RecipeClash[] = []
  const ingredients = recipe.ingredients
    .map(normalizeText)
    .filter((line) => line.trim() !== '')
  const lines = [normalizeText(recipe.title), ...ingredients]
  const knowsIngredients = ingredients.length > 0
  const tags = recipe.tags.map((tag) => normalizeText(tag).trim())

  for (const allergen of prefs.allergens) {
    const hit = matchRule(lines, ALLERGEN_RULES[allergen])
    if (hit && !hit.uncertain) {
      clashes.push({ kind: 'allergen', id: allergen, label: hit.term })
    } else if (hit) {
      clashes.push({
        kind: 'allergen',
        id: allergen,
        label: hit.term,
        uncertain: true,
      })
    } else if (!knowsIngredients) {
      clashes.push({
        kind: 'allergen',
        id: allergen,
        label: allergen,
        uncertain: true,
      })
    }
  }

  for (const diet of prefs.diets) {
    const rules = DIET_RULES[diet]
    let certain: RuleHit | null = null
    let unsure: RuleHit | null = null
    for (const rule of rules.clash) {
      const hit = matchRule(lines, rule)
      if (hit && !hit.uncertain) {
        certain = hit
        break
      }
      if (hit && !unsure) unsure = hit
    }
    if (!certain) {
      for (const rule of rules.unsure ?? []) {
        const hit = matchRule(lines, rule)
        if (hit && !unsure) unsure = { term: hit.term, uncertain: true }
      }
    }
    const tagged = tags.some((tag) => rules.tags.includes(tag))
    if (certain) {
      clashes.push({ kind: 'diet', id: diet, label: certain.term })
    } else if (unsure && !tagged) {
      clashes.push({ kind: 'diet', id: diet, label: unsure.term, uncertain: true })
    } else if (!knowsIngredients && !tagged) {
      clashes.push({ kind: 'diet', id: diet, label: diet, uncertain: true })
    }
  }

  const corpus = [...lines, ...tags.map((tag) => ` ${tag} `)].join(' ')
  // A dislike hides the recipe, so a short one must be a whole word, give or
  // take a plural or diminutive ("ui", "uien", "uitjes", "uienringen"), never
  // part of another word ("suiker", "uitgelekt", "eigeel", "hamburger"). A
  // longer one also counts inside a compound ("kastanjechampignons").
  const found = (form: string) =>
    form.length >= 5
      ? corpus.includes(form)
      : new RegExp(` ${form}(?:s|en|eren|je|jes|tje|tjes)? `).test(corpus) ||
        corpus.includes(` ${form}en`)
  for (const dislike of prefs.dislikes) {
    if (dislikeForms(dislike).some(found))
      clashes.push({ kind: 'dislike', label: dislike })
  }

  const limit = prefs.cookingMinutes[weekday]
  if (
    limit != null &&
    recipe.prepMinutes !== undefined &&
    recipe.prepMinutes > limit
  ) {
    clashes.push({
      kind: 'time',
      label: `${recipe.prepMinutes} min`,
      minutes: recipe.prepMinutes,
      limit,
    })
  }

  return clashes
}

/** True when nothing in `clashes` is certain: the recipe stays in the list. */
export function fitsPreferences(clashes: readonly RecipeClash[]): boolean {
  return clashes.every((clash) => clash.uncertain === true)
}

/**
 * One clash as the recipe search says it, in the reader's language:
 * "Bevat pinda", "Bevat champignons, staat bij liever niet",
 * "Controleer zelf: Melk".
 */
export function describeClash(
  clash: RecipeClash,
  m: Messages['mealPreferences'],
): string {
  if (clash.kind === 'time')
    return fmt(m.filter.tooLong, { minutes: clash.minutes, limit: clash.limit })
  if (clash.kind === 'dislike')
    return fmt(m.filter.containsDislike, { term: clash.label })
  const name =
    clash.kind === 'allergen'
      ? m.allergies.names[clash.id]
      : m.diet.names[clash.id]
  if (clash.uncertain) {
    // Without a term from the recipe, the label is the id: name the allergen
    // or diet; with one, name both ("Controleer zelf: bouillon (Selderij)").
    const what = clash.label === clash.id ? name : `${clash.label} (${name})`
    return fmt(m.filter.checkYourselfFor, { what })
  }
  return clash.kind === 'allergen'
    ? fmt(m.filter.contains, { term: clash.label })
    : fmt(m.filter.notDiet, { diet: name.toLocaleLowerCase(), term: clash.label })
}

/**
 * The short reasons for a status line ("pinda, champignons"): the matched
 * words of the certain clashes, each once.
 */
export function clashReasons(
  clashes: readonly RecipeClash[],
  m: Messages['mealPreferences'],
): string[] {
  const reasons = new Set<string>()
  for (const clash of clashes) {
    if (clash.uncertain) continue
    if (clash.kind === 'time')
      reasons.add(fmt(m.filter.tooLong, { minutes: clash.minutes, limit: clash.limit }))
    else reasons.add(clash.label)
  }
  return [...reasons]
}
