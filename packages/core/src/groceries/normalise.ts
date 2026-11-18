/**
 * Two forms of a grocery name.
 *
 * - `cleanGroceryName`: what the name says, readably — lower case, no article,
 *   no store brand, no amount. This is the text the AI fallback is asked about.
 * - `groceryKey`: the name reduced to word stems, so "tomaten", "tomaat" and
 *   "Tomaten" are one key. Dictionary terms, the shared AI cache and a Group's
 *   overrides are all keyed by it. The stems are not meant to be read: the
 *   only rule is that the same word always reduces to the same stem.
 */

/**
 * Store brands and labels a line may start with. They say where a product is
 * bought, not what it is, so they are dropped before the name is looked up.
 * Longest first, so "ah excellent" goes before "ah".
 */
const STORE_BRANDS = [
  'albert heijn excellent',
  'albert heijn',
  'ah excellent',
  'ah biologisch',
  'ah basic',
  'ah terra',
  'ah',
  'jumbo lekker veggie',
  'jumbo biologisch',
  'jumbo',
  'lidl',
  'aldi',
  'plus',
  'dirk',
  'coop',
  'spar',
  'hoogvliet',
  'vomar',
  'deen',
  'poiesz',
  'delhaize',
  'colruyt',
  'boni',
  'everyday',
  'ekoplaza',
  'kruidvat',
  'etos',
  'hema',
  "g'woon",
  'gwoon',
  'milbona',
  'smiling hill',
  '1 de beste',
  'huismerk',
]
  .map((brand) => brand.split(' '))
  .sort((a, b) => b.length - a.length)

const ARTICLES = new Set(['de', 'het', 'een', "'n", 'the', 'a', 'an'])

/** Words whose stem the general rules would get wrong. */
const IRREGULAR: Record<string, string> = {
  eieren: 'ei',
  eier: 'ei',
  eitje: 'ei',
  eitjes: 'ei',
  eggs: 'eg',
  egg: 'eg',
  kinderen: 'kind',
  leaves: 'leaf',
  knives: 'knife',
  loaves: 'loaf',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mango: 'mango',
  mangos: 'mango',
  mangoes: 'mango',
  // "penne" would otherwise share the stem of "peen" (carrot).
  penne: 'penne',
}

function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}'&+%.\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^[-'.]+|[-'.]+$/g, ''))
    .filter(Boolean)
}

/** The words of a name without a leading article and store brand. */
function nameWords(name: string): string[] {
  let list = words(name)
  while (list.length > 1 && ARTICLES.has(list[0])) list = list.slice(1)
  for (const brand of STORE_BRANDS) {
    if (
      list.length > brand.length &&
      brand.every((word, index) => list[index] === word)
    ) {
      list = list.slice(brand.length)
      break
    }
  }
  return list
}

/** Lower case, no leading article, no store brand. Readable. */
export function cleanGroceryName(name: string): string {
  return nameWords(name).join(' ')
}

/**
 * One word reduced to its stem: plural, diminutive, a final schwa, doubled
 * vowels and a doubled last consonant go, so "tomaten" and "tomaat" both give
 * "tomat", "kiwi's" and "kiwi" give "kiwi", "eitjes" gives "ei".
 */
export function stemGroceryWord(input: string): string {
  // "kiwi's", "taco's": the apostrophe-s is a plural, whatever the vowel.
  let word = foldDiacritics(input.toLowerCase())
    .replace(/'s$/, '')
    .replace(/'/g, '')
  const irregular = IRREGULAR[word]
  if (irregular) return irregular
  if (word.length <= 3 || /\d/.test(word)) return word

  if (word.endsWith('ies') && word.length > 4) word = `${word.slice(0, -3)}y`
  for (let round = 0; round < 2; round++) {
    if (word.endsWith('en') && word.length >= 4) word = word.slice(0, -2)
    else if (
      word.endsWith('s') &&
      word.length > 3 &&
      !/(ss|us|is|aas|ees|oos|uus)$/.test(word)
    )
      word = word.slice(0, -1)
    else break
  }

  if (word.endsWith('etje') && word.length > 6) word = word.slice(0, -4)
  else if (/[tp]je$/.test(word) && word.length > 4) word = word.slice(0, -3)
  else if (word.endsWith('je') && word.length > 4) word = word.slice(0, -2)

  word = word.replace(/([aeou])\1+/g, '$1')
  if (word.endsWith('e') && word.length > 3) word = word.slice(0, -1)
  if (/([b-df-hj-np-tv-z])\1$/.test(word)) word = word.slice(0, -1)
  if (word.endsWith('v')) word = `${word.slice(0, -1)}f`
  else if (word.endsWith('z')) word = `${word.slice(0, -1)}s`
  return word
}

/** A name's words, lower case, split at hyphens, without brand or article. */
export function groceryNameParts(name: string): string[] {
  return nameWords(name)
    .flatMap((word) => word.split('-'))
    .filter(Boolean)
}

/** The stems of a name's words, hyphens and all, without brand or article. */
export function groceryKeyWords(name: string): string[] {
  return groceryNameParts(name).map(stemGroceryWord)
}

/** The lookup key of a name: its stems joined by spaces. Empty for no name. */
export function groceryKey(name: string): string {
  return groceryKeyWords(name).join(' ')
}
