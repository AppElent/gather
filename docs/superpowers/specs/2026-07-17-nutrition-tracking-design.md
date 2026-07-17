# Nutrition Tracking — Recipe Nutrition, Foods Library, and Consumption Diary Design

**Date:** 2026-07-17
**Status:** Approved (design); ready for implementation planning
**Scope:** Adds nutritional information to the Recipes module, a global foods/products library
fed by barcode scanning (Open Food Facts) and manual entry, and a per-user consumption diary
with daily targets. Structured (quantity/unit/food-linked) recipe ingredients, household-level
consumption roll-ups, and per-ingredient nutrition databases (NEVO / USDA FoodData Central) are
explicitly deferred — but the data model is designed so they plug in without rework.

---

## 1. Context

Recipes today (`convex/schema.ts`, `convex/recipes.ts`, `convex/recipeImport.ts`,
`convex/lib/recipeParsing.ts`, `convex/lib/recipeAiExtract.ts`) store ingredients as free-text
strings and carry no nutrition data or servings count. The URL-import pipeline reads schema.org
Recipe JSON-LD (with a Claude fallback via `ANTHROPIC_API_KEY`) but ignores the JSON-LD
`nutrition` and `recipeYield` properties. `meal-planner`, `groceries`, and `pantry` are
placeholder routes; there is no consumption tracking of any kind.

The driving requirement (user's words): **the data is the most important thing.** External
recipes rarely include nutrition info, so the design centers on multiple capture paths —
imported when available, AI-estimated when not, manual always wins — and on a durable,
reusable food-product dataset.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Purpose | Per-user nutrition diary first; household views derivable later (no schema change needed) |
| Nutrient set | EU-label set: calories (kcal), protein, carbs, sugars, fat, saturated fat, fiber, salt (g) |
| Recipe nutrition capture | JSON-LD import → AI estimation → manual entry; manual always wins |
| Recipe nutrition basis | Per serving; recipes gain a `servings` field |
| Structured ingredients | **Deferred**, designed-for (foods table is the future link target) |
| Foods library scope | **Global** (app-wide) — a barcode's nutrition facts are objective data |
| Foods caching policy | Lazy: a food row is created only when actually used; never a bulk OFF import |
| OFF local overrides | Foods are editable; `localEdited` blocks silent OFF overwrites; explicit "refresh from OFF" allowed |
| Barcode lookup source | Open Food Facts API (free, no key, strong Dutch/EU coverage) |
| Barcode scanning | ZXing (WASM) camera scanning, native `BarcodeDetector` when available; manual EAN entry fallback |
| Diary shape | Day + meal slots (breakfast / lunch / dinner / snack) |
| Diary history | Entries snapshot label + computed nutrition at log time (immutable history) |
| Targets | Simple per-user daily targets (same NutritionFacts shape), progress on day view |
| Stale recipe nutrition | `nutritionStale` flag set on ingredient/servings edits; banner offers re-estimate; never auto-recompute |
| Estimation interface | One Convex action `estimateNutrition` is the single "text → nutrition" seam; backend swappable later (NEVO, etc.) |
| CalorieNinjas / API Ninjas | **Rejected**: service being sunset; successor paywalls `calories`/`protein_g`; English/US-centric parsing vs Dutch recipes; redundant with AI estimation |

---

## 3. Data model

### 3.1 Shared NutritionFacts shape

One reusable validator in `convex/lib/nutrition.ts`, used by recipes, foods, consumption
entries, and targets. All fields optional numbers:

```
calories (kcal), protein, carbs, sugars, fat, saturatedFat, fiber, salt   // grams except calories
```

Partial data is normal and never an error — store what a source provides, render only what
exists.

### 3.2 `recipes` (extended)

| Field | Type | Notes |
|---|---|---|
| `servings` | `optional(number)` | From JSON-LD `recipeYield`, AI, or manual |
| `nutrition` | `optional(NutritionFacts)` | **Per serving** |
| `nutritionSource` | `optional('imported' \| 'ai' \| 'manual')` | Shown as a badge for honesty about approximations |
| `nutritionStale` | `optional(boolean)` | See §5 |

### 3.3 `foods` (new, global)

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Search index for log-by-typing |
| `brand` | `optional(string)` | |
| `barcode` | `optional(string)` | Index `by_barcode`; absent for manual generic foods |
| `baseUnit` | `'g' \| 'ml'` | Basis for `nutritionPer100` |
| `nutritionPer100` | `NutritionFacts` | Per 100 g / 100 ml |
| `servingSize` | `optional(number)` | Grams/ml per serving, when known |
| `servingLabel` | `optional(string)` | e.g. "1 boterham (35 g)" |
| `source` | `'openfoodfacts' \| 'manual'` | |
| `localEdited` | `optional(boolean)` | Set on first local edit of an OFF row; re-scan then uses the local row; only an explicit "refresh from Open Food Facts" action may overwrite |
| `createdBy` | `id('users')` | Provenance only — no ownership semantics; readable/editable by all authenticated users |

Readable by any authenticated user (global library — scan once, everyone benefits). Lazy
cache: rows are written only when a user confirms saving a scanned/looked-up product or
creates one manually. Never bulk-imported.

### 3.4 `consumptionEntries` (new, strictly per-user)

| Field | Type | Notes |
|---|---|---|
| `userId` | `id('users')` | Index `by_user_date (userId, date)` |
| `date` | `string` | Client-local `YYYY-MM-DD` — no server timezone math |
| `meal` | `'breakfast' \| 'lunch' \| 'dinner' \| 'snack'` | |
| `recipeId` | `optional(id('recipes'))` | Mutually exclusive with `foodId`; neither = quick add |
| `foodId` | `optional(id('foods'))` | |
| `label` | `string` | Snapshot of recipe title / food name / typed label |
| `quantity` | `number` | |
| `quantityUnit` | `'serving' \| 'g' \| 'ml' \| 'piece'` | Recipes: always `serving`. Foods: `g`/`ml` (matching `baseUnit`) always available; `piece` (= one `servingSize` amount) only when `servingSize` exists. Quick add: fixed `quantity: 1`, unit `piece`, nutrition as typed |
| `nutrition` | `NutritionFacts` | **Snapshot of computed totals for this entry** at log time |

Snapshotting makes history immutable: editing or deleting a recipe/food never rewrites past
days. Dangling `recipeId`/`foodId` after deletion is fine — entries render from `label` +
`nutrition`; only the "view source" link is disabled. All queries/mutations filter strictly
on the authenticated user; entries are never group-visible in v1. Household roll-ups later
are additive (new queries), no schema change.

### 3.5 `users` (extended)

| Field | Type | Notes |
|---|---|---|
| `nutritionTargets` | `optional(NutritionFacts)` | Daily targets; set only the fields you care about (e.g. calories + protein) |

---

## 4. Data flow & features

### 4.1 URL import (extend existing pipeline)

`extractJsonLdRecipe` additionally extracts:

- `recipeYield` → `servings` — handles numbers, numeric strings, and strings like
  `"4 personen"` / `"4 servings"` (first integer wins; ranges like `"4-6"` take the lower
  bound).
- `nutrition` (`schema.org/NutritionInformation`) → per-serving `NutritionFacts`. Values are
  free text and messy: `"250 kcal"`, `"12,5 g"` (Dutch comma decimals), `"1046 kJ"`. A
  dedicated value parser handles unit suffixes, comma decimals, and kJ → kcal conversion
  (÷ 4.184). JSON-LD nutrition is treated as per-serving (the schema.org convention).

Unparseable nutrition fields are skipped silently; **nutrition problems never fail a recipe
import**. Imported values prefill the recipe form (`nutritionSource: 'imported'`) for review
before save, same as the rest of the import flow.

The AI extraction fallback (`recipeAiExtract.ts`) prompt is extended to also return
`servings` and a per-serving nutrition estimate (`nutritionSource: 'ai'`).

### 4.2 AI estimation action

New Convex action `estimateNutrition({ ingredients, servings })` → per-serving
`NutritionFacts`. Reuses the existing Anthropic client setup and `ANTHROPIC_API_KEY`
deployment env var. Validates the returned JSON shape, rejects negative values, tags results
`'ai'`. When the key is unset the UI hides/disables the button with a hint (same degradation
policy as import). This action is the **single seam** for text→nutrition estimation — a
future NEVO or other lookup backend replaces its internals without touching schema or UI.

Surfaced in two places: an "Estimate with AI" button on the recipe form's nutrition section,
and the stale-nutrition banner (§5).

### 4.3 Barcode scanning & Open Food Facts

Client flow (in the add-food UI):

1. Camera scan via ZXing WASM (`BarcodeDetector` used when the browser provides it). Camera
   permission denied, no camera, or unsupported browser → manual EAN digit entry field.
2. Barcode → local `foods.by_barcode` query first. Hit → use the local row (respecting local
   edits).
3. Miss → Convex action `lookupBarcode` queries Open Food Facts
   (`GET /api/v2/product/{barcode}` with a proper identifying `User-Agent`, 10 s timeout).
4. Found → mapped to the foods shape, shown to the user for confirmation, saved on confirm
   (lazy cache). Partial nutriment data is saved as-is.
5. Not found / OFF down → manual food form prefilled with the barcode. OFF being unavailable
   never blocks manual entry or logging.

Open Food Facts attribution (ODbL) is displayed where OFF-sourced data is shown.

### 4.4 Foods library UI

Part of the nutrition module: search foods by name (Convex search index), create manually
(name, brand, per-100 nutrition, optional serving size), edit any food (first edit of an OFF
row sets `localEdited`), explicit "refresh from Open Food Facts" on barcode-bearing rows
(overwrites local values after confirmation, clears `localEdited`).

### 4.5 Consumption diary (`/nutrition` route, new module tile)

Day view: date navigation (default today), four meal slots, per-day totals, and progress
bars against `nutritionTargets` for whichever target fields are set. Targets are edited in
the nutrition module's settings section.

"Add" in a meal slot opens a picker with three tabs:

- **Recipes** — the user's visible recipes (existing `isVisibleTo` model); quantity in
  servings (default 1); requires the recipe to have `nutrition` (recipes without it show a
  hint linking to the recipe to add/estimate it).
- **Foods** — name search + barcode scan (§4.3); quantity in g/ml always, or servings/pieces
  when `servingSize` is known.
- **Quick add** — label + nutrition typed directly (e.g. restaurant meal); no food row is
  created.

Entry nutrition is computed client-side at log time (`quantity` × per-unit values), stored
as the snapshot, and validated server-side in the mutation (non-negative, mutually exclusive
refs, quantity > 0). Entries can be edited (quantity/meal/date) or deleted. On quantity
edit the snapshot is recomputed from the current source values; if the source was deleted,
the existing snapshot is scaled proportionally to the quantity change instead. Totals update
reactively via `useQuery`.

### 4.6 Recipe page

Per-serving nutrition panel when data exists, with source badge (imported / AI-estimated /
manual) and servings count. The edit form gains a nutrition section: servings, the eight
nutrient fields, and the "Estimate with AI" button.

---

## 5. Stale recipe nutrition

Problem: an imported/estimated recipe is edited (ingredients or servings change) and the
stored nutrition silently no longer matches.

Rule: the `recipes.update` mutation sets `nutritionStale: true` whenever `ingredients` or
`servings` change in a save that does not also change `nutrition`. Any save that changes
`nutrition` (manual edit or AI re-estimate) clears the flag.

UI: recipe page and form show a subtle banner — "Ingredients changed since nutrition was
calculated — re-estimate?" — with a one-tap AI re-estimate and a link to edit manually.
Never auto-recompute (AI calls cost money; a typo fix shouldn't nuke good data). Diary
entries logged before a fix keep their snapshots — history stays true to what was known at
log time.

---

## 6. Error handling summary

| Failure | Behavior |
|---|---|
| JSON-LD nutrition unparseable (any field) | Skip field silently; import never fails on nutrition |
| JSON-LD `recipeYield` unparseable | `servings` left unset; nutrition still stored per-serving as published |
| AI estimation: bad JSON / negatives / API error | Action throws `ConvexError` with friendly message; form values untouched |
| `ANTHROPIC_API_KEY` unset | AI buttons hidden/disabled with hint; JSON-LD + manual paths unaffected |
| OFF: product not found | Manual food form prefilled with barcode |
| OFF: timeout / API down | Same as not-found, plus non-blocking error toast; local library + manual entry keep working |
| Camera denied / unsupported | Manual EAN entry field |
| Food without `servingSize` | Only g/ml quantity options offered (no guessing) |
| Recipe/food deleted after logging | Entries render from snapshots; source link disabled |
| Recipe without nutrition in diary picker | Hint + link to the recipe to add/estimate nutrition first |

---

## 7. Testing

### 7.1 Real-site JSON-LD fixture suite (hard requirement)

During implementation, capture the actual `ld+json` payloads from ~6–8 Dutch recipe sites
with differing JSON-LD structures — target list: ah.nl (Allerhande), leukerecepten.nl,
miljuschka.nl (WP Recipe Maker), 24kitchen.nl, lekkerensimpel.com, uitpaulineskeuken.nl,
jumbo.com — plus 1–2 international (e.g. bbcgoodfood.com, allrecipes.com). Substitutes are
fine if a site publishes no JSON-LD; the goal is structural variety (bare Recipe, `@graph`,
`mainEntity`, WP Recipe Maker output), not those exact domains.

Stored as committed fixture files under `convex/lib/__fixtures__/jsonld/` (the extracted
JSON-LD blob per site, not full HTML) with a README recording source URL and capture date.
Each fixture gets assertions on title / ingredients / steps / `servings` / **`nutrition`**
extraction. Repeatable offline; the natural home for regression fixtures whenever a site
breaks in the future.

### 7.2 Unit tests (pure functions, existing vitest pattern)

- Nutrition value parser: `"250 kcal"`, `"12,5 g"`, `"1046 kJ"` → kcal, garbage → undefined.
- `recipeYield` parser: numbers, `"4 personen"`, ranges, garbage.
- Quantity → nutrition math: per-100 g/ml scaling, servings, pieces via `servingSize`.
- Staleness logic: extracted as a pure function (`shouldMarkStale(before, after)`), tested
  across the change matrix.
- OFF response mapping: captured OFF API JSON fixtures (complete, partial nutriments,
  missing serving size) → foods shape.
- AI estimation response validation: shape checks, negative rejection.

### 7.3 Existing tests

The synthetic JSON-LD tests in `recipeParsing.test.ts` stay as-is; new extraction fields get
synthetic cases there too (the fixture suite covers real-world mess, synthetic covers the
spec).

---

## 8. Phasing (one spec, three shippable phases)

1. **Recipe nutrition** — nutrition validator lib; recipes schema fields; JSON-LD
   nutrition/servings extraction + value parser + fixture suite; AI extraction prompt
   extension; `estimateNutrition` action; recipe form nutrition section; recipe page panel;
   staleness flag + banner.
2. **Foods library** — foods table + indexes; OFF `lookupBarcode` action + response mapping;
   barcode scanner component (ZXing + manual fallback); food search/create/edit UI with
   `localEdited` protection + OFF refresh; ODbL attribution.
3. **Diary & targets** — `consumptionEntries` table; `/nutrition` day view with meal slots
   and totals; three-tab add picker; entry edit/delete; `nutritionTargets` on users +
   settings UI + progress display; module tile added to the app shell/dashboard.

Each phase ships independently useful value; later phases depend on earlier ones (diary
needs foods for its Foods tab, but its Recipes/Quick-add tabs only need phase 1).

---

## 9. Out of scope (deferred, designed-for)

- **Structured ingredients** (`{quantity, unit, foodId}` on recipes): the foods table is the
  future link target; AI-parsing existing free-text ingredients is the expected migration
  path. Bottom-up computed recipe nutrition becomes a fourth `nutritionSource` then.
- **Per-ingredient nutrition databases**: NEVO (RIVM, Dutch) or USDA FoodData Central as a
  future `estimateNutrition` backend or generic-foods source.
- **Household consumption views**: additive queries over `consumptionEntries` with explicit
  sharing consent — no schema change anticipated.
- **Meal planner integration**: logging a planned meal in one tap once meal-planner exists.
- **CalorieNinjas / API Ninjas nutrition API**: rejected (see §2) — sunset announced,
  successor paywalls calories/protein, English-centric parsing.
