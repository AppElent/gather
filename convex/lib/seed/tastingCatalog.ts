import type { TastingKind } from '@gather/core/tastings'

/**
 * The shipped list of well-known things, present in every environment
 * including production.
 *
 * **This is a picker, not a reference table (ADR-0024).** It behaves in the
 * opposite way to `catalogFoods.ts`, and a reader who knows that file will
 * guess wrong, so the difference is worth saying out loud once more here:
 *
 * - A **foods** Catalog row is a *fact*. A Group points at it forever and may
 *   never edit it.
 * - A **tasting** Catalog row is a *suggestion*. Choosing one copies its name
 *   and facts into the Group as that Group's own subject, keeping `catalogKey`
 *   as Provenance, and the row here is then irrelevant to it. Retiring an
 *   entry orphans nothing; a household correcting "its" Comté is correcting
 *   its own row.
 *
 * `seedKey` is the stable identity across re-seeds and never changes once
 * shipped, even if `name` does — a renamed key orphans nothing here either,
 * but it does make one household's existing copy stop matching, so it is still
 * not a thing to do casually.
 *
 * **Cheese only.** A list of every wine is not a thing (story 6), and shipping
 * beer *styles* as subjects would change what a beer subject is — that is a
 * separate decision, recorded as out of scope in #199. The Kind spec already
 * says which Kinds have a catalog; this file is what makes that true, and the
 * core test asserts the two agree.
 *
 * Attributes are the cheese Kind's `subjectFields`, and only the ones a
 * generic entry can honestly answer: milk, country and style. **No producer
 * and no age** — those are properties of the wheel somebody actually bought,
 * and prefilling them would put a guess in a household's own record.
 */
export interface TastingCatalogEntry {
  seedKey: string
  kind: TastingKind
  name: string
  attributes: Record<string, string | number | string[]>
}

function cheese(
  seedKey: string,
  name: string,
  milk: string,
  country: string,
  style: string,
): TastingCatalogEntry {
  return {
    seedKey,
    kind: 'cheese',
    name,
    attributes: { milk, country, style },
  }
}

export const TASTING_CATALOG: TastingCatalogEntry[] = [
  // France
  cheese('cheese-comte', 'Comté', 'cow', 'france', 'hard'),
  cheese('cheese-brie-de-meaux', 'Brie de Meaux', 'cow', 'france', 'soft'),
  cheese('cheese-camembert', 'Camembert de Normandie', 'cow', 'france', 'soft'),
  cheese('cheese-roquefort', 'Roquefort', 'sheep', 'france', 'blue'),
  cheese('cheese-epoisses', 'Époisses', 'cow', 'france', 'soft'),
  cheese('cheese-reblochon', 'Reblochon', 'cow', 'france', 'soft'),
  cheese('cheese-morbier', 'Morbier', 'cow', 'france', 'semiHard'),
  cheese(
    'cheese-tomme-de-savoie',
    'Tomme de Savoie',
    'cow',
    'france',
    'semiHard',
  ),
  cheese(
    'cheese-crottin-de-chavignol',
    'Crottin de Chavignol',
    'goat',
    'france',
    'fresh',
  ),
  cheese(
    'cheese-sainte-maure',
    'Sainte-Maure de Touraine',
    'goat',
    'france',
    'soft',
  ),
  cheese('cheese-ossau-iraty', 'Ossau-Iraty', 'sheep', 'france', 'hard'),
  cheese('cheese-mimolette', 'Mimolette', 'cow', 'france', 'hard'),

  // Italy
  cheese(
    'cheese-parmigiano-reggiano',
    'Parmigiano Reggiano',
    'cow',
    'italy',
    'hard',
  ),
  cheese('cheese-pecorino-romano', 'Pecorino Romano', 'sheep', 'italy', 'hard'),
  cheese('cheese-gorgonzola', 'Gorgonzola', 'cow', 'italy', 'blue'),
  cheese('cheese-taleggio', 'Taleggio', 'cow', 'italy', 'soft'),
  cheese(
    'cheese-mozzarella-di-bufala',
    'Mozzarella di Bufala',
    'buffalo',
    'italy',
    'fresh',
  ),
  cheese('cheese-burrata', 'Burrata', 'cow', 'italy', 'fresh'),
  cheese('cheese-fontina', 'Fontina', 'cow', 'italy', 'semiHard'),
  cheese('cheese-provolone', 'Provolone', 'cow', 'italy', 'semiHard'),

  // Netherlands and Belgium
  cheese('cheese-gouda', 'Gouda', 'cow', 'netherlands', 'semiHard'),
  cheese('cheese-oude-gouda', 'Oude Gouda', 'cow', 'netherlands', 'hard'),
  cheese('cheese-edam', 'Edam', 'cow', 'netherlands', 'semiHard'),
  cheese('cheese-leidse-kaas', 'Leidse kaas', 'cow', 'netherlands', 'semiHard'),
  cheese('cheese-boerenkaas', 'Boerenkaas', 'cow', 'netherlands', 'hard'),
  cheese(
    'cheese-geitenkaas',
    'Hollandse geitenkaas',
    'goat',
    'netherlands',
    'semiHard',
  ),
  cheese('cheese-chimay', 'Chimay à la Bière', 'cow', 'belgium', 'semiHard'),

  // Switzerland, Germany, Austria
  cheese('cheese-gruyere', 'Gruyère', 'cow', 'switzerland', 'hard'),
  cheese('cheese-emmentaler', 'Emmentaler', 'cow', 'switzerland', 'hard'),
  cheese('cheese-appenzeller', 'Appenzeller', 'cow', 'switzerland', 'hard'),
  cheese('cheese-raclette', 'Raclette', 'cow', 'switzerland', 'semiHard'),
  cheese('cheese-cambozola', 'Cambozola', 'cow', 'germany', 'blue'),
  cheese('cheese-bergkase', 'Bergkäse', 'cow', 'austria', 'hard'),

  // Britain and Ireland
  cheese('cheese-cheddar', 'Cheddar', 'cow', 'unitedKingdom', 'hard'),
  cheese('cheese-stilton', 'Stilton', 'cow', 'unitedKingdom', 'blue'),
  cheese(
    'cheese-red-leicester',
    'Red Leicester',
    'cow',
    'unitedKingdom',
    'hard',
  ),
  cheese(
    'cheese-wensleydale',
    'Wensleydale',
    'cow',
    'unitedKingdom',
    'semiHard',
  ),
  cheese('cheese-cashel-blue', 'Cashel Blue', 'cow', 'ireland', 'blue'),

  // Iberia, Greece, Scandinavia
  cheese('cheese-manchego', 'Manchego', 'sheep', 'spain', 'hard'),
  cheese('cheese-mahon', 'Mahón', 'cow', 'spain', 'semiHard'),
  cheese('cheese-idiazabal', 'Idiazábal', 'sheep', 'spain', 'hard'),
  cheese(
    'cheese-queijo-serra',
    'Queijo Serra da Estrela',
    'sheep',
    'portugal',
    'soft',
  ),
  cheese('cheese-feta', 'Feta', 'sheep', 'greece', 'fresh'),
  cheese('cheese-halloumi', 'Halloumi', 'mixed', 'other', 'semiHard'),
  cheese('cheese-havarti', 'Havarti', 'cow', 'denmark', 'semiHard'),
]
