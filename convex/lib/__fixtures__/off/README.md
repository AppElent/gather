# Real Open Food Facts fixtures

Captured `/api/v2/product/{barcode}` JSON responses, used by
`convex/lib/offMapping.test.ts` to test the OFF response mapper against real
product data (spec §7.2).

Refresh or add a fixture with:

    curl -s -A "gather-nutrition-tracker/1.0" "https://world.openfoodfacts.org/api/v2/product/<barcode>.json" > convex/lib/__fixtures__/off/<name>.json

(These two were captured via a real browser fetch instead of `curl` — outbound
network access was unavailable from the shell in the environment that captured
them — then trimmed to the fields `offMapping.ts` actually reads:
`product_name`, `product_name_nl`, `brands`, `nutriments`, `serving_size`,
`serving_quantity`, plus `status`/`code`. Every value below is the real,
unmodified value the live API returned at capture time; only the surrounding
image/ingredients/packaging noise was dropped. Regenerating via `curl` gives
the full untrimmed document, which is also fine — the mapper ignores fields it
doesn't read.)

| Fixture | Barcode | Captured |
|---|---|---|
| nutella.json | 3017620422003 | 2026-07-18 |
| hagelslag.json (AH Puur Hagelslag) | 8718906716223 | 2026-07-18 |

## Notes on what each fixture actually contains

- **nutella.json**: `nutriments` has no `fiber_100g` (exercises the
  "nutrient absent" path). `brands` is `"Nutella, Ferrero, Yum yum"`
  (comma-separated — mapper takes the first). `product_name_nl` **is present**
  and equal to `"Nutella"` — as of this capture, OFF's community-edited data no
  longer matches the "Nutella has no Dutch name" assumption made during
  planning (OFF is a live, crowd-edited database and can change between
  planning and capture). Since the brand name is unchanged across languages,
  this doesn't exercise a *visible* difference between the Dutch-preference
  path and the fallback path — that distinction is covered by the synthetic
  edge-case tests in `offMapping.test.ts` instead (`Generic Name` vs
  `Nederlandse Naam`, and the fiber-less `Basic Item` case). No
  `serving_size`/`serving_quantity` published.
- **hagelslag.json**: a genuinely Dutch product (Albert Heijn's own-brand
  chocolate sprinkles), single-brand `brands` (no comma-splitting needed),
  `fiber_100g: 7` present (the counterpart to Nutella's absent fiber), and both
  `serving_quantity: 20` (number) and `serving_size: "20 gram"` (string)
  present together.
