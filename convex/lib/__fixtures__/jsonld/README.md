# Real-site JSON-LD fixtures

Captured `application/ld+json` Recipe payloads from live recipe sites, used
by `convex/lib/recipeParsingFixtures.test.ts` to test extraction against
real-world variety (spec: docs/superpowers/specs/2026-07-17-nutrition-tracking-design.md §7.1).

Refresh or add a fixture with:

    node convex/lib/__fixtures__/jsonld/capture.script.mjs "<recipe-url>" <name>

When a site changes structure and breaks imports in production, capture the
new payload here and fix the parser against it.

| Fixture | Source URL | Captured |
|---|---|---|
| leukerecepten.json | https://www.leukerecepten.nl/recepten/foe-yong-hai-recept/ | 2026-07-17 |
| lekkerensimpel.json | https://www.lekkerensimpel.com/nasi-goreng-recept/ | 2026-07-17 |
| uitpaulineskeuken.json | https://uitpaulineskeuken.nl/recept/courgette-ovenschotel | 2026-07-17 |
| 24kitchen.json | https://www.24kitchen.nl/recepten/warm-crispy-roomijspakketje | 2026-07-17 |
| keukenliefde.json | https://www.keukenliefde.nl/recepten/pasta-carbonara-met-bacon-en-groene-asperges/ | 2026-07-17 |
| ah.json | https://www.ah.nl/allerhande/recept/R-R1202561/spicy-komkommersalade-met-kip-en-witte-bonen | 2026-07-17 |
| jumbo.json | https://www.jumbo.com/recepten/pompoen-traybake-met-aardappel-en-worst-999625 | 2026-07-17 |
| bbcgoodfood.json | https://www.bbcgoodfood.com/recipes/chicken-tikka-masala | 2026-07-17 |

7 of 9 target sites plus 1 substitute succeeded (6 Dutch sites captured
directly from the plan's target list, keukenliefde.nl substituted in for a
seventh). Two sites were skipped:

- **miljuschka.nl** — blocked every request with `403 Forbidden` (tried two
  different recipe URLs, and both the capture script's `fetch` and the
  WebFetch tool). Substituted **keukenliefde.nl** (also WP Recipe Maker
  output, `@graph`-wrapped) as a same-structure Dutch replacement.
- **allrecipes.com** — blocked bot traffic with an HTTP `402` "access issue"
  page (People Inc's bot-paywall network), including via WebFetch. Not
  substituted since bbcgoodfood.com already covers the "international site
  with full nutrition" case; 8 fixtures across 7 sites was judged sufficient
  structural variety without chasing a 9th.

## Structural variety captured

- **WP Recipe Maker plugin output**: leukerecepten.nl (bare `Recipe` node,
  `HowToSection`-grouped steps), lekkerensimpel.com and keukenliefde.nl and
  uitpaulineskeuken.nl (`@graph`-wrapped, flat `HowToStep` steps).
- **`recipeYield` shapes**: array of strings (`leukerecepten`,
  `lekkerensimpel`), single-element array (`uitpaulineskeuken`), plain string
  (`keukenliefde`, `ah`), string with trailing unit word (`jumbo`: `"4
  porties"`, `24kitchen`: `"1 portion"`), plain number (`bbcgoodfood`: `10`).
- **`nutrition` presence**: absent entirely (`lekkerensimpel`, `24kitchen`,
  `keukenliefde`), calories-only (`jumbo`), partial — no sugars/fiber/salt
  (`ah`), and full 8-field blocks (`leukerecepten`, `uitpaulineskeuken`,
  `bbcgoodfood`).
- **Corporate sites**: ah.nl and jumbo.com both fetch fine directly (no bot
  block encountered), each with their own JSON-LD generator quirks (ah.nl
  uses a bare `Recipe` node with a `["", "<url>"]` empty-slot image array;
  jumbo.com nests a `VideoObject` alongside the recipe).
- **Duration format**: 24kitchen.nl emits the full ISO 8601 form with an
  explicit (zero) day designator — `"P0DT0H4M"` — instead of the more common
  `"PT4M"`. This broke `parseIsoDurationMinutes` (see below).
- **Unit spelling**: bbcgoodfood.com spells nutrition units out in full
  English words (`"19 grams fat"`, `"1.04 milligram of sodium"`) rather than
  abbreviating (`"19 g"`, `"1.04 mg"`).

## Parser gaps found and fixed

Both were genuine extraction gaps exposed by real captured payloads, each
fixed in the parser with a synthetic regression test added alongside the
existing unit tests (not just adjusted in the fixture assertion):

1. **`parseIsoDurationMinutes` didn't accept a day designator.**
   24kitchen.nl's `prepTime` is `"P0DT0H4M"` (valid ISO 8601), but the regex
   required the string to start with literal `"PT"`, so it returned
   `undefined` for a recipe that clearly states a 4-minute prep time. Fixed
   in `convex/lib/recipeParsing.ts` by accepting an optional `(\d+)D` between
   `P` and `T`, added to the total as whole days. Regression test:
   `convex/lib/recipeParsing.test.ts` → `parseIsoDurationMinutes` →
   `"parses the full ISO 8601 form with a (zero) day designator"`.

2. **`parseNutritionValue` didn't recognize spelled-out `"milligram"`.**
   bbcgoodfood.com's `sodiumContent` is `"1.04 milligram of sodium"`; the
   existing regex only checked for the literal substring `"mg"`, which
   `"milligram"` doesn't contain (no adjacent `m`+`g`), so the value was
   treated as if it were already in grams (a ~1000x overstatement of salt
   content). Fixed in `convex/lib/nutrition.ts` by also matching
   `/milligram/i`. Regression test: `convex/lib/nutrition.test.ts` →
   `parseNutritionValue` → `"converts spelled-out 'milligram' to g"`.
   Caveat: with the fix, bbcgoodfood's `1.04 mg` sodium rounds to `0` g of
   salt at the 2-decimal precision this codebase uses — a suspiciously tiny
   number for a curry recipe, and possibly a data-quality bug in BBC's own
   structured data (their displayed salt content may well be in whole grams,
   not milligrams, despite the property name). We parse the label literally
   rather than guess at the "more plausible" number; flagged here for
   visibility if it looks wrong in production.

## Test-infra note: `import.meta.url` under jsdom

`recipeParsingFixtures.test.ts` reads fixtures via
`readFileSync(new URL('./relative.json', import.meta.url))`. Under this
project's default `jsdom` test environment, Vite's client-side "asset URL"
transform intercepts that exact `new URL(..., import.meta.url)` pattern and
resolves it against a fake `http://localhost` origin instead of disk. The
fixture test file opts into the Node environment per-file
(`// @vitest-environment node`) to get real `file://` resolution — safe here
since the file does no DOM work.
