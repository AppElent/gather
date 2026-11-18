// Builds the grocery dictionary in @gather/core
// (packages/core/src/groceries/data/dictionary.generated.ts) from:
//   - Open Food Facts, Open Beauty Facts and Open Products Facts CSV exports,
//     products sold in the Netherlands or Belgium only, and the Open Food
//     Facts category taxonomy. Names, brands and categories only: no
//     barcodes, no nutrition. ODbL; the derived list stays ODbL.
//   - NEVO online 2025/9.0 (RIVM): food names, synonyms and food groups.
//   - curated.txt: terms written by hand for Gather.
// The input versions are pinned in inputs.json; the build stops when a
// downloaded file differs, unless --update-inputs records the new one.
//
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/build-dictionary.ts \
//     --open-facts <dir with off.csv.gz, obf.csv.gz, opf.csv.gz, categories.json> \
//     --nevo <path to NEVO2025_v9.0.csv> [--update-inputs]
//
// The first run per download extracts the NL/BE rows next to the downloads
// (*.nlbe.tsv), which takes a few minutes for Open Food Facts.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import zlib from 'node:zlib'
import {
  GROCERY_AISLES,
  type GroceryAisle,
  isGroceryAisle,
} from '../../packages/core/src/groceries/aisles'
import {
  createGroceryDictionary,
  DICTIONARY_SOURCES,
  type DictionaryData,
} from '../../packages/core/src/groceries/dictionary'
import { groceryKey } from '../../packages/core/src/groceries/normalise'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const OUTPUT = path.join(
  root,
  'packages/core/src/groceries/data/dictionary.generated.ts',
)
const INPUTS = path.join(here, 'inputs.json')
const CURATED = path.join(here, 'curated.txt')

type Aisle = Exclude<GroceryAisle, 'other'>
type Votes = Map<string, Map<Aisle, number>>

function vote(votes: Votes, key: string, aisle: Aisle, weight = 1) {
  if (!key) return
  const tally = votes.get(key) ?? new Map<Aisle, number>()
  tally.set(aisle, (tally.get(aisle) ?? 0) + weight)
  votes.set(key, tally)
}

/** The winning aisle of each key with enough support and agreement. */
function decide(
  votes: Votes,
  minimum: number,
  agreement: number,
): Map<string, Aisle> {
  const decided = new Map<string, Aisle>()
  for (const [key, tally] of votes) {
    let total = 0
    let best: Aisle | undefined
    let bestCount = 0
    for (const [aisle, count] of tally) {
      total += count
      if (count > bestCount) {
        best = aisle
        bestCount = count
      }
    }
    if (best && total >= minimum && bestCount / total >= agreement)
      decided.set(key, best)
  }
  return decided
}

// A term is useful only when it is short and plain: no amounts, no codes.
function usableKey(key: string, maxWords = 3): boolean {
  if (key.length < 2 || key.length > 40) return false
  if (/\d/.test(key)) return false
  if (!/^[a-z' &+.-]+$/.test(key)) return false
  return key.split(' ').length <= maxWords
}

// ---------------------------------------------------------------------------
// Inputs and their versions

interface InputFile {
  url: string
  lastModified?: string
  bytes: number
  sha256: string
}

type InputManifest = Record<string, InputFile>

const OPEN_FACTS_FILES: Record<string, string> = {
  'off.csv.gz':
    'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz',
  'obf.csv.gz':
    'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz',
  'opf.csv.gz':
    'https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv.gz',
  'categories.json':
    'https://static.openfoodfacts.org/data/taxonomies/categories.json',
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function checkInputs(
  openFacts: string,
  nevo: string,
  update: boolean,
): Promise<InputManifest> {
  const pinned: InputManifest = fs.existsSync(INPUTS)
    ? JSON.parse(fs.readFileSync(INPUTS, 'utf8'))
    : {}
  const files: Record<string, { file: string; url: string }> = {
    'NEVO2025_v9.0.csv': {
      file: nevo,
      url: 'https://www.rivm.nl/nederlands-voedingsstoffenbestand (NEVO online 2025/9.0, via the workouts repo data/nevo/)',
    },
  }
  for (const [name, url] of Object.entries(OPEN_FACTS_FILES))
    files[name] = { file: path.join(openFacts, name), url }

  const found: InputManifest = {}
  const problems: string[] = []
  for (const [name, { file, url }] of Object.entries(files)) {
    if (!fs.existsSync(file)) {
      problems.push(`${name}: missing at ${file} (download ${url})`)
      continue
    }
    const bytes = fs.statSync(file).size
    const known = pinned[name]
    // Hashing 1.5 GB takes a while: trust an unchanged size unless updating.
    const hash =
      !update && known && known.bytes === bytes ? known.sha256 : await sha256(file)
    found[name] = { ...known, url: known?.url ?? url, bytes, sha256: hash }
    if (!known || known.bytes !== bytes || known.sha256 !== hash)
      problems.push(
        `${name}: ${bytes} bytes ${hash.slice(0, 12)}… does not match inputs.json`,
      )
  }
  if (problems.length > 0 && !update)
    throw new Error(
      `${problems.join('\n')}\nRun with --update-inputs to record new downloads, and set their lastModified by hand.`,
    )
  if (update) fs.writeFileSync(INPUTS, `${JSON.stringify(found, null, 2)}\n`)
  return update ? found : pinned
}

// ---------------------------------------------------------------------------
// Open Facts: NL/BE rows

interface Product {
  name: string
  generic: string
  brands: string[]
  categories: string[]
}

const NLBE = /\b(en:netherlands|en:belgium)\b/

/** Stream a CSV export once and keep the NL/BE rows' few useful columns. */
async function extractNlBe(gz: string, out: string) {
  const lines = readline.createInterface({
    input: fs.createReadStream(gz).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  const output = fs.createWriteStream(`${out}.partial`)
  let columns: number[] | undefined
  let kept = 0
  for await (const line of lines) {
    const fields = line.split('\t')
    if (!columns) {
      const at = (name: string) => fields.indexOf(name)
      const brands = at('brands') >= 0 ? at('brands') : at('brands_en')
      columns = [
        at('product_name'),
        at('generic_name'),
        brands,
        at('categories_tags'),
        at('countries_tags'),
      ]
      if (columns.some((index) => index < 0))
        throw new Error(`${gz}: unexpected columns`)
      continue
    }
    if (!NLBE.test(fields[columns[4]] ?? '')) continue
    output.write(
      `${columns.map((index) => (fields[index] ?? '').replace(/[\t\r\n]/g, ' ')).join('\t')}\n`,
    )
    kept++
  }
  await new Promise<void>((resolve, reject) =>
    output.end((error?: Error | null) => (error ? reject(error) : resolve())),
  )
  fs.renameSync(`${out}.partial`, out)
  console.error(`extracted ${kept} NL/BE rows from ${path.basename(gz)}`)
}

async function readProducts(dir: string, name: string): Promise<Product[]> {
  const gz = path.join(dir, `${name}.csv.gz`)
  const tsv = path.join(dir, `${name}.nlbe.tsv`)
  if (!fs.existsSync(tsv)) await extractNlBe(gz, tsv)
  const products: Product[] = []
  for (const line of fs.readFileSync(tsv, 'utf8').split('\n')) {
    if (!line) continue
    const [productName, generic, brands, categories] = line.split('\t')
    products.push({
      name: productName ?? '',
      generic: generic ?? '',
      brands: (brands ?? '')
        .split(',')
        .map((brand) => brand.trim())
        .filter(Boolean),
      categories: (categories ?? '').split(',').filter(Boolean),
    })
  }
  return products
}

// ---------------------------------------------------------------------------
// Open Food Facts categories → aisles
//
// Each rule names a taxonomy category; a category takes the aisle of its
// nearest ruled ancestor, and on a tie the rule listed first. Frozen is a
// property of the product, so any frozen category wins.

const CATEGORY_RULES: [Aisle, string[]][] = [
  [
    'frozen',
    [
      'en:frozen-foods',
      'en:ice-creams-and-sorbets',
      'en:frozen-desserts',
      'en:ice-creams',
      'en:frozen-vegetables',
      'en:fish-fingers',
      'en:fries',
      'en:potato-fries',
      'en:frozen-potato-fries',
      'en:puff-pastry-sheets',
    ],
  ],
  [
    'care_baby',
    ['en:baby-foods', 'en:baby-milks', 'en:infant-formulas', 'en:dietary-supplements'],
  ],
  [
    'cheese_deli',
    [
      'en:cheeses',
      'en:cheese-spreads',
      'en:hummus',
      'en:salted-spreads',
      'en:prepared-salads',
      'en:hams',
      'en:white-hams',
      'en:salami',
      'en:dry-sausages',
      'en:cooked-chicken-breast-slices',
      'en:tapenades',
      'en:dips',
      'en:cured-sausages',
      'en:cooked-sausages',
      'en:pate',
    ],
  ],
  [
    'breakfast',
    [
      'en:breakfast-cereals',
      'en:mueslis',
      'en:rolled-oats',
      'en:sweet-spreads',
      'en:jams',
      'en:honeys',
      'en:peanut-butters',
      'en:nut-butters',
      'en:chocolate-sprinkles',
      'en:sprinkles',
      'en:cocoa-and-hazelnuts-spreads',
      'en:chocolate-spreads',
      'en:rusks',
      'en:crispbreads',
      'en:puffed-rice-cakes',
      'en:gingerbreads',
      'en:coffees',
      'en:teas',
      'en:herbal-teas',
      'en:cocoa-powders',
      'en:crackers-breakfast',
      'en:extruded-crispbreads',
    ],
  ],
  [
    'dairy',
    [
      'en:plant-based-milk-alternatives',
      'en:milks',
      'en:chocolate-milks',
      'en:milkshakes',
      'en:yogurts',
      'en:dairy-desserts',
      'en:puddings',
      'en:creams',
      'en:plant-based-creams-for-cooking',
      'en:butters',
      'en:margarines',
      'en:eggs',
      'en:quarks',
      'en:fermented-milk-products',
      'en:dairies',
    ],
  ],
  [
    'meat_fish',
    [
      'en:smoked-sausages',
      'en:bacon',
      'en:meat-analogues',
      'en:meat-alternatives',
      'en:sausages',
      'en:chicken-breasts',
      'en:chickens',
      'en:beef',
      'en:pork',
      'en:poultries',
      'en:meats',
      'en:fishes',
      'en:seafood',
      'en:shrimps',
    ],
  ],
  [
    'pasta_world',
    [
      'en:tortillas',
      'en:wheat-flatbreads',
      'en:pastas',
      'en:noodles',
      'en:rices',
      'en:quinoa',
      'en:bulgur',
      'en:pasta-sauces',
      'en:pestos',
      'en:soy-sauces',
      'en:coconut-milks',
      'en:curry-pastes',
      'en:coconut-milks-and-creams',
      'en:sambal',
      'en:satay-sauces',
      'en:peanut-sauces',
      'en:oyster-sauces',
      'en:sesame-oils',
      'en:sushi-rice',
      'en:prawn-crackers',
    ],
  ],
  [
    'tins_sauces',
    [
      'en:canned-foods',
      'en:canned-fishes',
      'en:soups',
      'en:sauces',
      'en:condiments',
      'en:mayonnaises',
      'en:ketchup',
      'en:mustards',
      'en:vegetable-oils',
      'en:olive-oils',
      'en:vinegars',
      'en:salts',
      'en:spices',
      'en:flours',
      'en:sugars',
      'en:sweeteners',
      'en:broths',
      'en:bouillon-cubes',
      'en:pickles',
      'en:olives',
      'en:compotes',
      'en:legumes',
      'en:cooking-helpers',
      'en:salad-dressings',
      'en:canned-tomatoes',
      'en:peeled-tomatoes',
      'en:tomato-pastes',
      'en:yeast',
      'en:baking-mixes',
      'en:baking-powder-or-raising-agent',
    ],
  ],
  [
    'drinks',
    [
      'en:alcoholic-beverages',
      'en:waters',
      'en:sodas',
      'en:fruit-juices',
      'en:beverages',
    ],
  ],
  ['bakery', ['en:breads', 'en:viennoiseries', 'en:pastries', 'en:cakes', 'en:pies']],
  [
    'snacks',
    [
      'en:dried-fruits',
      'en:nuts',
      'en:biscuits',
      'en:speculoos',
      'en:waffles',
      'en:chocolates',
      'en:candies',
      'en:confectioneries',
      'en:crisps',
      'en:crackers-appetizers',
      'en:popcorn',
      'en:salty-snacks',
      'en:cereal-bars',
      'en:biscuits-and-cakes',
      'en:sweet-snacks',
      'en:snacks',
    ],
  ],
  [
    'produce',
    [
      'en:fresh-vegetables',
      'en:fresh-fruits',
      'en:culinary-plants',
      'en:herbs',
      'en:lettuces',
      'en:potatoes',
      'en:mushrooms',
      'en:fruits',
      'en:vegetables',
    ],
  ],
]

/** Categories that say nothing about the aisle, or about several. */
const UNRULED_ROOTS = new Set(['en:meals', 'en:pizzas', 'en:sandwiches'])

interface TaxonomyEntry {
  name?: Record<string, string>
  parents?: string[]
  synonyms?: Record<string, string[]>
}

type Taxonomy = Record<string, TaxonomyEntry>

function categoryAisles(taxonomy: Taxonomy) {
  const ruleOf = new Map<string, { aisle: Aisle; order: number }>()
  let order = 0
  for (const [aisle, tags] of CATEGORY_RULES)
    for (const tag of tags) {
      if (!taxonomy[tag]) throw new Error(`category rule ${tag} not in taxonomy`)
      ruleOf.set(tag, { aisle, order: order++ })
    }

  const cache = new Map<string, Aisle | null>()
  function aisleOf(tag: string): Aisle | null {
    const known = cache.get(tag)
    if (known !== undefined) return known
    // Breadth first up the parents: the nearest rule wins, the earlier rule
    // on a tie; any frozen ancestor makes it frozen; a mixed-dishes root met
    // before any rule leaves it unplaced.
    let level = [tag]
    const seen = new Set(level)
    let found: { aisle: Aisle; order: number } | undefined
    let frozen = false
    let canned = false
    let blocked = false
    while (level.length > 0) {
      const next: string[] = []
      let best: { aisle: Aisle; order: number } | undefined
      let reachedRoot = false
      for (const current of level) {
        const rule = ruleOf.get(current)
        if (rule?.aisle === 'frozen') frozen = true
        if (current === 'en:canned-foods') canned = true
        else if (rule && (!best || rule.order < best.order)) best = rule
        if (UNRULED_ROOTS.has(current)) reachedRoot = true
        for (const parent of taxonomy[current]?.parents ?? [])
          if (!seen.has(parent)) {
            seen.add(parent)
            next.push(parent)
          }
      }
      if (!found && !blocked && best) found = best
      if (!found && reachedRoot) blocked = true
      level = next
    }
    // Frozen and tinned say where in the shop a product is, whatever it is.
    const result = frozen ? 'frozen' : canned ? 'tins_sauces' : (found?.aisle ?? null)
    cache.set(tag, result)
    return result
  }
  return aisleOf
}

/** The aisle of a product: frozen if any category is, else its most specific categories' majority. */
function productAisle(
  categories: string[],
  taxonomy: Taxonomy,
  aisleOf: (tag: string) => Aisle | null,
): Aisle | null {
  const known = categories.filter((tag) => taxonomy[tag])
  if (known.length === 0) return null
  const ancestors = new Set<string>()
  for (const tag of known)
    for (const parent of taxonomy[tag]?.parents ?? []) ancestors.add(parent)
  const leaves = known.filter((tag) => !ancestors.has(tag))
  const tally = new Map<Aisle, number>()
  for (const tag of known) if (aisleOf(tag) === 'frozen') return 'frozen'
  for (const tag of leaves) {
    const aisle = aisleOf(tag)
    if (aisle) tally.set(aisle, (tally.get(aisle) ?? 0) + 1)
  }
  let best: Aisle | null = null
  let bestCount = 0
  for (const [aisle, count] of tally)
    if (count > bestCount) {
      best = aisle
      bestCount = count
    }
  // Two leaves that disagree evenly say nothing.
  return bestCount * 2 > leaves.length || tally.size === 1 ? best : null
}

/** Words a product name keeps after its brands are taken out. */
function nameWithoutBrands(name: string, brands: string[]): string {
  let rest = ` ${name.toLowerCase()} `
  for (const brand of brands) {
    const lower = brand.toLowerCase()
    if (lower.length < 2) continue
    rest = rest.split(` ${lower} `).join(' ')
    if (rest.startsWith(` ${lower} `)) rest = rest.slice(lower.length + 1)
  }
  return rest.replace(/\s+/g, ' ').trim()
}

interface SourceTerms {
  /** Terms from taxonomy names, product names and the like. */
  terms: Map<string, Aisle>
  /** Brand names, kept apart so the report can count them. */
  brands: Map<string, Aisle>
}

function openFoodFactsTerms(products: Product[], taxonomy: Taxonomy): SourceTerms {
  const aisleOf = categoryAisles(taxonomy)
  const used = new Map<string, number>()
  for (const product of products)
    for (const tag of product.categories) used.set(tag, (used.get(tag) ?? 0) + 1)

  // Category names, in Dutch and English, of categories NL/BE products use.
  const names: Votes = new Map()
  for (const [tag, count] of used) {
    if (count < 2) continue
    const aisle = aisleOf(tag)
    const entry = taxonomy[tag]
    if (!aisle || !entry) continue
    for (const language of ['nl', 'en']) {
      const labels = [entry.name?.[language], ...(entry.synonyms?.[language] ?? [])]
      for (const label of labels) {
        if (!label) continue
        const key = groceryKey(label)
        if (usableKey(key)) vote(names, key, aisle, count)
      }
    }
  }

  const productNames: Votes = new Map()
  const brandVotes: Votes = new Map()
  for (const product of products) {
    const aisle = productAisle(product.categories, taxonomy, aisleOf)
    if (!aisle) continue
    for (const name of [product.name, product.generic]) {
      if (!name) continue
      const key = groceryKey(nameWithoutBrands(name, product.brands))
      if (usableKey(key)) vote(productNames, key, aisle)
    }
    for (const brand of product.brands.slice(0, 1)) {
      const key = groceryKey(brand)
      if (usableKey(key, 2)) vote(brandVotes, key, aisle)
    }
  }

  const terms = decide(productNames, 2, 0.75)
  for (const [key, aisle] of decide(names, 1, 0.6)) terms.set(key, aisle)
  return { terms, brands: decide(brandVotes, 4, 0.8) }
}

// Open Beauty Facts sells care products only; Open Products Facts sells
// everything, of which only care, baby and household products go in.
const OPF_CARE =
  /diaper|nappy|luier|feminine|menstrual|sanitary|incontinen|maandverband|tampon|oral-care|toothbrush|tandenborstel|shav|scheer|deodorant|personal-care|verzorging|baby|zelfzorg|keelpastille|medicine|vitamin|voedingssupplement|hand/
const OPF_HOUSEHOLD =
  /household|cleaning|schoonmaak|laundry|was-?middel|detergent|dishwash|vaatwas|vaisselle|paper-products|toilet-paper|batter|light-bulb|candle|cat-litter|pet-supplies|cat-supplies|dog|garbage|trash|vuilniszak|aluminium|foil|coffee-filter|huishouden/
const OPF_SKIP = /tobacco|cigar|sex|vibrator|masturbat|condoom|glijmiddel|publication|book|media|electronic|toy|game|office|apparel|clothing|car|auto/

function tagLabel(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')
}

function careAndHouseholdTerms(
  products: Product[],
  aisleOfProduct: (product: Product) => Aisle | null,
  skipTag: (tag: string) => boolean,
): SourceTerms {
  const labels: Votes = new Map()
  const productNames: Votes = new Map()
  const brandVotes: Votes = new Map()
  for (const product of products) {
    const aisle = aisleOfProduct(product)
    if (!aisle) continue
    for (const tag of product.categories) {
      if (skipTag(tag)) continue
      const key = groceryKey(tagLabel(tag))
      if (usableKey(key, 2)) vote(labels, key, aisle)
    }
    const key = groceryKey(nameWithoutBrands(product.name, product.brands))
    if (usableKey(key, 2)) vote(productNames, key, aisle)
    for (const brand of product.brands.slice(0, 1)) {
      const brandKey = groceryKey(brand)
      if (usableKey(brandKey, 2)) vote(brandVotes, brandKey, aisle)
    }
  }
  const terms = decide(productNames, 2, 0.8)
  for (const [key, aisle] of decide(labels, 2, 0.8)) terms.set(key, aisle)
  return { terms, brands: decide(brandVotes, 3, 0.8) }
}

// ---------------------------------------------------------------------------
// NEVO

/** NEVO food groups → aisles; null drops the group (mixed dishes). */
const NEVO_GROUPS: Record<string, Aisle | null> = {
  'Aardappelen en knolgewassen': 'produce',
  'Alcoholische dranken': 'drinks',
  Brood: 'bakery',
  Diversen: null,
  Eieren: 'dairy',
  'Flesvoeding en preparaten': 'care_baby',
  Fruit: 'produce',
  'Gebak en koek': 'snacks',
  'Graanproducten en meelsoorten': 'pasta_world',
  Groente: 'produce',
  'Hartig broodbeleg': 'cheese_deli',
  'Hartige sauzen': 'tins_sauces',
  'Hartige snacks en zoutjes': 'snacks',
  Kaas: 'cheese_deli',
  'Kruiden en specerijen': 'tins_sauces',
  'Melk en melkproducten': 'dairy',
  'Niet-alcoholische dranken': 'drinks',
  'Noten en zaden': 'snacks',
  Peulvruchten: 'tins_sauces',
  'Samengestelde gerechten': null,
  Soepen: 'tins_sauces',
  'Suiker, snoep, zoet beleg en zoete sauzen': 'snacks',
  'Vetten en oliën': 'tins_sauces',
  'Vis, schaal- en schelpdieren': 'meat_fish',
  'Vlees en gevogelte': 'meat_fish',
  Vleeswaren: 'cheese_deli',
  'Vleesvervangers en zuivelvervangers': 'meat_fish',
}

/** Words in a NEVO name that move a food to another aisle than its group's. */
const NEVO_OVERRIDES: [RegExp, Aisle][] = [
  [/\bdiepvries|\bbevroren|\bijs\b|\bijs room|\bwaterijs/i, 'frozen'],
  [/\bblik\b|\bblik\/glas|\bglas\b|\bconserven/i, 'tins_sauces'],
  [/^(koffie|thee|cacao)\b|\bkoffie(?! ?-)|\bthee\b/i, 'breakfast'],
  [/^(jam|hagelslag|honing|stroop|pasta chocolade|vlokken|pindakaas|muesli|cruesli|ontbijt|beschuit|cracker|knackebrod|roggebrood|krentenbol)/i, 'breakfast'],
  [/^(boter|margarine|halvarine|room|slagroom|kookroom)\b/i, 'dairy'],
  [/^(drink (soja|rijst|haver|amandel|kokos)|drink\b.*-$|yoghurt soja|toetje soja)/i, 'dairy'],
  [/^(olie|vet)\b/i, 'tins_sauces'],
  [/^(rijst|pasta|macaroni|spaghetti|mie|noedel|couscous|tortilla|wrap)/i, 'pasta_world'],
  [/^(meel|bloem|maizena|paneermeel|bakpoeder)/i, 'tins_sauces'],
  [/^(ontbijtkoek)/i, 'breakfast'],
]

/** Words in NEVO names that describe preparation, not the product. */
const NEVO_DESCRIPTORS = new Set([
  'rauw', 'gekookt', 'gebakken', 'gegrild', 'gestoofd', 'gefrituurd',
  'bereid', 'onbereid', 'gem', 'gemiddeld', 'gedroogd', 'gezouten',
  'ongezouten', 'gesneden', 'm', 'z', 'zonder', 'met', 'en', 'of', 'in',
  'op', 'obv', 'ca', 'e.d.', 'toev', 'magnetron', 'naturel', 'light',
  'verrijkt', 'vezel', 'blik/glas', 'blik', 'glas', 'diepvries',
])

function nevoTerms(file: string): Map<string, Aisle> {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const header = lines[0].split('|').map((cell) => cell.replace(/"/g, ''))
  const group = header.indexOf('Voedingsmiddelgroep')
  const dutch = header.indexOf('Voedingsmiddelnaam/Dutch food name')
  const synonym = header.indexOf('Synoniem')
  if (group < 0 || dutch < 0 || synonym < 0) throw new Error('NEVO: unexpected columns')

  const votes: Votes = new Map()
  const unknownGroups = new Set<string>()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split('|').map((cell) => cell.replace(/^"|"$/g, '').trim())
    const groupName = cells[group]
    if (!(groupName in NEVO_GROUPS)) {
      unknownGroups.add(groupName)
      continue
    }
    const name = cells[dutch]
    let aisle = NEVO_GROUPS[groupName]
    for (const [pattern, override] of NEVO_OVERRIDES)
      if (pattern.test(name)) {
        aisle = override
        break
      }
    if (!aisle) continue

    // "Broodje koffie- …" is a koffiebroodje; "Tomaat rauw" a tomaat.
    const words = name
      .replace(/\(.*?\)/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
    const heads = (words[0] ?? '').split('/')
    const modifier = words[1]?.endsWith('-') ? words[1].slice(0, -1) : undefined
    for (const head of heads) {
      if (!head || NEVO_DESCRIPTORS.has(head.toLowerCase())) continue
      if (modifier) vote(votes, groceryKey(modifier + head.toLowerCase()), aisle)
      else vote(votes, groceryKey(head), aisle)
    }
    for (const alternative of (cells[synonym] ?? '').split('/')) {
      const plain = alternative
        .split(/\s+/)
        .filter((word) => word && !NEVO_DESCRIPTORS.has(word.toLowerCase()))
        .join(' ')
      const key = groceryKey(plain)
      if (usableKey(key, 2)) vote(votes, key, aisle)
    }
  }
  if (unknownGroups.size > 0)
    throw new Error(`NEVO: unmapped food groups ${[...unknownGroups].join(', ')}`)
  const terms = decide(votes, 1, 0.6)
  for (const key of terms.keys()) if (!usableKey(key)) terms.delete(key)
  return terms
}

// ---------------------------------------------------------------------------
// Curated

/** `aisle: term, term, …` lines; `#` starts a comment. */
function curatedTerms(file: string): Map<string, Aisle> {
  const terms = new Map<string, Aisle>()
  for (const [index, raw] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    const aisle = line.slice(0, colon).trim()
    if (colon < 0 || !isGroceryAisle(aisle) || aisle === 'other')
      throw new Error(`curated.txt:${index + 1}: expected "aisle: terms"`)
    for (const term of line.slice(colon + 1).split(',')) {
      const key = groceryKey(term)
      if (!key) continue
      const known = terms.get(key)
      if (known && known !== aisle)
        throw new Error(`curated.txt:${index + 1}: "${term}" is also under ${known}`)
      terms.set(key, aisle)
    }
  }
  return terms
}

// ---------------------------------------------------------------------------
// Merge, prune, write

function pack(entries: Map<string, Map<Aisle, number>>): DictionaryData {
  const byAisle = new Map<Aisle, string[]>()
  for (const [key, aisles] of [...entries].sort(([a], [b]) => (a < b ? -1 : 1)))
    for (const [aisle, mask] of aisles) {
      const list = byAisle.get(aisle) ?? []
      list.push(`${key}:${mask}`)
      byAisle.set(aisle, list)
    }
  const data: DictionaryData = {}
  for (const aisle of GROCERY_AISLES) {
    const list = byAisle.get(aisle as Aisle)
    if (list) data[aisle] = list.join('|')
  }
  return data
}

async function main() {
  const { values } = parseArgs({
    options: {
      'open-facts': { type: 'string' },
      nevo: { type: 'string' },
      'update-inputs': { type: 'boolean', default: false },
    },
  })
  const openFacts = values['open-facts']
  const nevo = values.nevo
  if (!openFacts || !nevo)
    throw new Error('usage: build-dictionary.ts --open-facts <dir> --nevo <csv>')

  const inputs = await checkInputs(openFacts, nevo, values['update-inputs'] ?? false)
  const taxonomy: Taxonomy = JSON.parse(
    fs.readFileSync(path.join(openFacts, 'categories.json'), 'utf8'),
  )

  const off = openFoodFactsTerms(await readProducts(openFacts, 'off'), taxonomy)
  const obf = careAndHouseholdTerms(
    await readProducts(openFacts, 'obf'),
    (product) =>
      OPF_HOUSEHOLD.test(product.categories.join(',')) ? 'household' : 'care_baby',
    (tag) => /open-beauty-facts|non-food|accessor|geschenk|reisverpakking/.test(tag),
  )
  const opf = careAndHouseholdTerms(
    await readProducts(openFacts, 'opf'),
    (product) => {
      const tags = product.categories.join(',')
      if (OPF_SKIP.test(tags)) return null
      if (OPF_CARE.test(tags)) return 'care_baby'
      if (OPF_HOUSEHOLD.test(tags)) return 'household'
      return null
    },
    (tag) => !OPF_CARE.test(tag) && !OPF_HOUSEHOLD.test(tag),
  )
  const nevoMap = nevoTerms(nevo)
  const curated = curatedTerms(CURATED)

  // Open Facts as one source: food first, then care and household, which
  // know their own products better than a food category does.
  const openFactsMap = new Map<string, Aisle>()
  for (const source of [off.terms, off.brands, obf.terms, obf.brands, opf.terms, opf.brands])
    for (const [key, aisle] of source) if (!openFactsMap.has(key)) openFactsMap.set(key, aisle)

  const all = new Map<string, Map<Aisle, number>>()
  const add = (source: Map<string, Aisle>, bit: number) => {
    for (const [key, aisle] of source) {
      const aisles = all.get(key) ?? new Map<Aisle, number>()
      aisles.set(aisle, (aisles.get(aisle) ?? 0) | bit)
      all.set(key, aisles)
    }
  }
  add(curated, DICTIONARY_SOURCES.curated)
  add(nevoMap, DICTIONARY_SOURCES.nevo)

  // A phrase that Open Facts' own single words already place the same way
  // adds nothing: drop it to keep the bundle small. Only Open Facts' words
  // decide, so the Open Facts-only score stays its own.
  const words = new Map<string, Aisle>()
  const phrases = new Map<string, Aisle>()
  for (const [key, aisle] of openFactsMap)
    (key.includes(' ') ? phrases : words).set(key, aisle)
  const wordsOnly = new Map<string, Map<Aisle, number>>()
  for (const [key, aisle] of words) wordsOnly.set(key, new Map([[aisle, 1]]))
  const wordDictionary = createGroceryDictionary(pack(wordsOnly))
  let pruned = 0
  for (const [key, aisle] of phrases) {
    const hit = wordDictionary.lookup(key)
    if (hit?.aisle === aisle && hit.match !== 'typo') {
      pruned++
      phrases.delete(key)
    }
  }
  add(words, DICTIONARY_SOURCES.openFacts)
  add(phrases, DICTIONARY_SOURCES.openFacts)

  const data = pack(all)
  const counts = Object.fromEntries(
    Object.entries(data).map(([aisle, packed]) => [aisle, packed.split('|').length]),
  )
  const summary = {
    terms: all.size,
    openFacts: openFactsMap.size,
    openFoodFactsBrands: off.brands.size,
    openBeautyFacts: obf.terms.size + obf.brands.size,
    openProductsFacts: opf.terms.size + opf.brands.size,
    nevo: nevoMap.size,
    curated: curated.size,
    prunedOpenFactsPhrases: pruned,
  }
  console.error(JSON.stringify({ summary, counts }, null, 2))

  const sources = Object.entries(inputs)
    .map(
      ([name, input]) =>
        ` *   ${name}: ${input.bytes} bytes, sha256 ${input.sha256}${input.lastModified ? `, Last-Modified ${input.lastModified}` : ''}`,
    )
    .join('\n')
  const body = [
    '/**',
    ' * GENERATED by scripts/groceries/build-dictionary.ts; do not edit by hand.',
    ' * Licence and attribution: ./README.md. This list is a derived database',
    ' * of Open Food Facts, Open Beauty Facts and Open Products Facts, available',
    ' * under the Open Database License (ODbL) 1.0. Terms flagged nevo (bit 2)',
    ' * are based on data from NEVO online version 2025/9.0, RIVM, Bilthoven.',
    ' *',
    ' * Inputs (scripts/groceries/inputs.json):',
    sources,
    ` * Terms: ${all.size}.`,
    ' */',
    "import type { DictionaryData } from '../dictionary'",
    '',
    'export const DICTIONARY_DATA: DictionaryData = {',
    ...Object.entries(data).map(([aisle, packed]) => `  ${aisle}:\n    '${packed.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`),
    '}',
    '',
  ].join('\n')
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, body)
  console.error(`wrote ${path.relative(root, OUTPUT)} (${(body.length / 1024).toFixed(0)} KB)`)
}

await main()
