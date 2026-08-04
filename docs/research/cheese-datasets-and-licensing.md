# Which cheese dataset gather can ship, and under what licence

Research note for [issue #51](https://github.com/AppElent/gather/issues/51), part of the
[Cheeses / Tasting substrate effort (#43)](https://github.com/AppElent/gather/issues/43).
Measured 2026-08-04 against the live Wikidata Query Service. Every count below came from
a query in this document; none is an estimate.

## Recommendation

**Use Wikidata, and nothing else, for the shipped fixture.** It is the only candidate whose
licence permits what we actually want to do — commit somebody else's data into a public
source repository and leave it there forever — and it permits it without conditions, because
CC0 has none. Everything richer is either unlicensed (cheese.com and every mirror of it) or
carries a share-alike obligation that would attach to the committed file (Open Food Facts).

**Query the union of `P31/P279*` and `P279+`, not "instances of cheese".** The issue proposed
"instances of cheese `Q10943`". That query returns 829 items, and **Cheddar, Gouda, Brie,
Camembert and Emmental are not among them** — on Wikidata the well-known varieties are modelled
as *subclasses* of cheese, and the instance branch is dominated by an import of the Italian
*prodotto agroalimentare tradizionale* registry (570 of its 762 country-bearing rows are Italian).
Shipping the instance query would produce a cheese catalogue with no Cheddar in it. The union
is 2069 items and contains all of them.

**Ship roughly 350 rows, not 2000.** Of the 2069, **347 carry an English Wikipedia article, a
country of origin, and a real milk source together**, and **288 of those also carry an image**.
The remainder are either bare registry entries with a name and a country, or classes like
"French cheese" that are categories rather than varieties. 347 well-formed subjects is a better
Catalog than 2069 rows of which a quarter are not cheeses.

**Expect to hand-author three of the five attributes.** Wikidata has name, country and milk
source as clean controlled vocabularies. It has **no fat-content property on cheese items at all**,
**no texture property**, and pasteurisation only as a class membership on 111 of 2069. Those
fields come from a human or they do not come.

---

## What we may not do

Recorded explicitly so this is not re-argued in six months.

**We may not ship cheese.com data, in any form, from any mirror.** cheese.com asserts copyright
over its content — "All content on cheese.com's web pages is copyrighted to Cheese.com (including
text, copy, logos, pictures, source code, and design)"
([cheese.com terms](https://www.cheese.com/cheese-gifts/terms/)) — and has granted nobody a
redistribution licence. The Kaggle datasets that mirror it (e.g.
[Global Cheese Dataset](https://www.kaggle.com/datasets/umerhaddii/global-cheese-dataset),
[Cheese](https://www.kaggle.com/datasets/joebeachcapital/cheese)) declare CC0 or similar in
Kaggle's licence dropdown. **That field is the uploader's assertion, not a grant.** The uploader
never held the rights, so they could not relicense them; a CC0 label applied to somebody else's
copyrighted database transfers nothing. Downstream reuse of a scrape is not laundered by passing
through Kaggle, and the fact that a dataset is popular and has been forked twenty times is not
evidence of permission. This applies equally to GitHub mirrors and to Gigasheet-style re-hosts.

**We may not vendor Open Food Facts data into this repo.** OFF is ODbL 1.0
([openfoodfacts.org/terms-of-use](https://world.openfoodfacts.org/terms-of-use)), which is a
share-alike licence for *databases*, and a committed TypeScript fixture built by extracting a
substantial part of OFF is a Derivative Database, not a Produced Work. See the analysis below —
this is the case people get wrong, and getting it wrong means silently placing an ODbL obligation
on a file in a public repo that has no LICENSE at all.

**We may not bundle Wikimedia Commons image files into the fixture.** Wikidata's CC0 covers the
`P18` *statement* — the filename — and not the file. Commons files are individually licensed and
many are CC BY-SA, which would require us to carry per-file author and licence credit. See
"Images" below.

**We may not treat "it's on the internet and nobody will notice" as a licence.** The fixture is
permanent and in a public repo. That is the whole reason this question was asked.

---

## The licences, from each source's own words

### Wikidata — CC0, unconditional

> "All structured data in the main, property and lexeme namespaces is made available under the
> Creative Commons CC0 License (Public domain)"
> — [Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)

CC0 imposes no attribution requirement and no share-alike. There is nothing to comply with, no
notice to carry, and no obligation that propagates into a repo that vendors it. Labels,
descriptions, and all statement values (`P495`, `P186`, `P18`, `P1389`, …) are covered.

This is the only candidate where the answer to "may we commit this forever into a public repo?"
is a flat yes.

**Attribution is nonetheless worth carrying**, not as compliance but as provenance: a fixture row
that records the Q-id it came from is a row somebody can go and check, and the generation script
can re-run against it. That is a data-quality argument, not a legal one.

### cheese.com and its Kaggle/GitHub mirrors — no

Answered above. Two further notes on the evidence.

cheese.com is behind bot protection and refused every automated fetch attempted for this note
(WebFetch returned nothing for `/`, `/about/`, `/robots.txt` and `/cheese-gifts/terms/`). The
copyright statement quoted above was recovered through search indexing of the terms page rather
than read directly, so it is quoted at one remove — see "Gaps". **The block itself is a fact worth
recording**: a site actively defending against automated access is not a site that has tacitly
consented to being scraped.

The dispositive point does not depend on the exact wording anyway. Absent an affirmative licence,
the default is all rights reserved. A database of cheese facts also attracts the EU *sui generis*
database right independently of copyright in the individual facts, which protects the investment in
compiling it — so "facts aren't copyrightable" is not the escape hatch it is often taken for when
the thing being copied is a substantial part of the compilation.

### Open Food Facts — ODbL 1.0, and the wrong shape of data anyway

> "The Open Food Facts database is available under the
> [Open Database License](https://opendatacommons.org/licenses/odbl/1.0/). The individual contents
> of the database are available under the
> [Database Contents License](https://opendatacommons.org/licenses/dbcl/1.0/). Products images are
> available under the
> [Creative Commons Attribution ShareAlike licence](https://creativecommons.org/licenses/by-sa/3.0/deed.en)."
> — [OFF terms of use](https://world.openfoodfacts.org/terms-of-use), repeated on
> [the data page](https://world.openfoodfacts.org/data)

**Why the share-alike matters here and does not matter for what gather already does.** ODbL draws
a line between two things ([ODbL 1.0 text](https://opendatacommons.org/licenses/odbl/1-0/)):

- A **Derivative Database** — "a database based upon the Database, and includes any translation,
  adaptation, arrangement, modification, or any other alteration of the Database or of a
  Substantial part of the Contents." Publicly using one triggers §4.4 Share Alike: it must be
  offered under ODbL or a compatible licence.
- A **Produced Work** — "a work (such as an image, audiovisual material, text, or sounds) resulting
  from using the whole or a Substantial part of the Contents (via a search or other query)."
  Produced Works are *exempt* from share-alike; §4.3 requires only a notice saying where the data
  came from.

`convex/lib/offFetch.ts` fetches one product by barcode and renders it. That is a query producing
a work — the Produced Work side of the line, notice-only. **A vendored fixture is on the other
side.** Extracting a substantial part of OFF into a structured file, committing it, and shipping it
is exactly the Derivative Database case, and §4.4 would require that file to be licensed ODbL. That
is not viral over gather's TypeScript — ODbL is a database licence, not a code licence — but it
would mean one file in the repo carries a licence the repo does not otherwise have, with a notice
obligation, and anyone may take it and redistribute it. gather is a **public repo with no LICENSE
file and no `license` field in `package.json`**, so introducing a single ODbL-licensed artefact into
it is a decision, not a formality.

None of which we have to resolve, because **OFF holds branded products, not varieties**. Its unit is
a barcode: "Président Brie 200g", not "Brie de Meaux AOP". There is no variety-level record to lift.
Wikidata already cross-references it where the two overlap — `P5930` (Open Food Facts ingredient ID)
appears on 27 items and `P1821` (OFF food category ID) on 25, out of 829 — which is the whole extent
of the useful overlap.

### EU eAmbrosia / GIview — CC BY 4.0, but there is no file to take

The Union register of geographical indications is published by DG AGRI. Its entry on the EU open
data portal declares its licence as the **"European Commission reuse notice"**
([data.europa.eu API](https://data.europa.eu/api/hub/search/search?q=eambrosia&filter=dataset&limit=3)),
which is the Commission Decision of 12 December 2011 on the reuse of Commission documents
(32011D0833) and resolves to **Creative Commons Attribution 4.0 International (CC BY 4.0)**, requiring
appropriate credit and an indication of changes
([European Commission legal notice](https://commission.europa.eu/legal-notice_en)).

So the register *is* redistributable, with attribution. Two reasons it is not the answer:

1. **The declared distribution format is HTML only** — the portal record offers no CSV or API
   distribution. Building a fixture from it means scraping the register's pages, which the reuse
   notice permits but which is real work for data we can largely get for free.
2. **Wikidata already carries the cross-reference.** `P9854` (eAmbrosia ID) is on **170** of the
   2069 union items. Every PDO/PGI cheese worth having is in Wikidata with a link back.

Keep it in reserve as the authority for correcting a PDO/PGI designation, not as a bulk source.
[GIview](https://www.tmdn.org/giview/) is the richer front end but is a single-page app with no
readable terms page — see "Gaps".

### USDA FoodData Central — public domain, but wrong data

> "USDA FoodData Central data are in the public domain and they are not copyrighted."
> — [fdc.nal.usda.gov](https://fdc.nal.usda.gov/), published under CC0 1.0, with citation
> requested but not required.

Cleanest possible licence. It is a *nutrition* database keyed to generic and branded foods, not a
varieties register — it would tell us the fat content of "Cheese, cheddar" but not that Brie de
Meaux is a French cow's-milk soft cheese. Its relevance is to the food Catalog, which
[#43 puts out of scope](https://github.com/AppElent/gather/issues/43), not to the Tasting substrate.
Wikidata carries `P1978` (USDA NDB number) on 7 items and `P12917` (FoodData Central ID) on 2 — the
overlap is negligible.

---

## Coverage, measured

### The set definition is the finding

Four ways of asking Wikidata for cheeses give four different answers:

| Query | Count |
| --- | --- |
| `?c wdt:P31 wd:Q10943` (direct instances) | 706 |
| `?c wdt:P31/wdt:P279* wd:Q10943` (instances, class hierarchy walked) | 829 |
| `?c wdt:P279* wd:Q10943` (subclasses) | 1417 |
| union of the instance and subclass branches | **2069** |

The instance branch is not a cheese catalogue. Its country distribution is **Italy 570, France 64,
Belgium 19, Armenia 8, Spain 8** — 75% Italian — and its `P1389` (product certification) values are
**485 × *prodotto agroalimentare tradizionale***, the Italian traditional-products registry. It is a
bulk import of one national register wearing the label "cheese".

Whether the famous cheeses are in it is checkable directly:

| Item | in instance branch | in subclass branch |
| --- | --- | --- |
| Cheddar cheese (Q217525) | **false** | true |
| Gouda (Q593675) | **false** | true |
| brie (Q193411) | **false** | true |
| Camembert (Q131480) | **false** | true |
| Emmental (Q932214) | **false** | true |
| Parmesan (Q155922) | true | true |
| Roquefort (Q189221) | true | true |
| mozzarella (Q14088) | true | true |

The modelling is simply inconsistent, and any query that picks one branch loses half the catalogue.
Take the union.

### Field coverage over the union (n = 2069)

| Field | Property | Present | % |
| --- | --- | --- | --- |
| English label | `rdfs:label` @en | 1699 | 82% |
| English description | `schema:description` @en | 1522 | 74% |
| Country of origin | `P495` | 1792 | 87% |
| Milk source (whitelisted values only) | `P186` | 788 | 38% |
| Image | `P18` | 835 | 40% |
| Any parent class (family/texture proxy) | `P279` | 1422 | 69% |
| Product certification (PDO/PGI/AOC/PAT) | `P1389` | 758 | 37% |
| eAmbrosia ID | `P9854` | 170 | 8% |
| TasteAtlas ID | `P5456` | 593 | 29% |
| Raw-milk cheese (class membership) | `P279` → Q1531597 | 71 | 3% |
| Pasteurised-milk cheese (class membership) | `P279` → Q19341731 | 40 | 2% |
| **Fat content** | *(no property exists on any cheese item)* | **0** | **0%** |
| **Texture** | *(no property exists on any cheese item)* | **0** | **0%** |

"Whitelisted values only" for `P186` means the five actual milk items (cow, sheep, goat, buffalo,
donkey). Raw `P186` is higher but includes rennet, table salt, *Penicillium roqueforti* and, on one
item, straw.

The absence of fat content and texture is not an inference from their being low — it is that a
census of every property used on cheese items, down to properties appearing on a single item,
contains no such property. The closest things are `P7971` (food energy, 2 items) and `P2067` (mass,
5 items) on the instance branch; both are useless at this volume.

### Joint completeness — the number that matters

| Combination | Count |
| --- | --- |
| English label ∧ country | 1521 |
| Has an English Wikipedia article | 582 |
| ≥ 5 sitelinks (recognisable across languages) | 476 |
| ≥ 10 sitelinks | 262 |
| **enwiki ∧ country ∧ milk source** | **347** |
| **enwiki ∧ country ∧ milk source ∧ image** | **288** |

For comparison, the same joint measurement on the instance branch alone gives **130** with
label ∧ country ∧ milk and **109** with an image added — which is what shipping the query as the
issue proposed it would have yielded, minus Cheddar.

**347 is the honest size of a usable Wikidata cheese fixture.** The English-Wikipedia filter is
doing real work: it is the cheapest available proxy for "a household might plausibly encounter
this", and it drops the registry chaff without hand-curating 2069 rows.

### Controlled vocabularies

The union's `P186` values, by frequency:

| Q-id | Value | Count |
| --- | --- | --- |
| Q10988133 | cow's milk | 560 |
| Q2736146 | sheep milk | 146 |
| Q1418287 | goat milk | 123 |
| Q513631 | raw milk | 18 |
| Q8495 | milk (unspecified) | 17 |
| Q1912004 | yak milk | 4 |
| Q7224064 | water buffalo milk | 3 |
| Q1239497 | donkey milk | 1 |

plus, mixed into the same property, `Q326900` rennet (6), `Q133247` *Penicillium roqueforti* (6),
`Q11254` table salt (6), `Q185009` whey (4), `Q622563` curd (3), `Q2577263` flour mite (3) and a
long tail. **`P186` is "made from material", not "milk source"** — it must be filtered against a
whitelist, not mapped wholesale. Filtered, it is a genuinely clean four-value enum with a
long-tail fifth.

The union's `P279` parent classes, top of the distribution:

`Q2223649` French cheese 394 · `Q3088299` cow's-milk cheese 366 · `Q10943` cheese 255 ·
`Q17315191` Italian cheese 176 · `Q198815` goat cheese 110 · `Q3088318` farmstead cheese 104 ·
`Q3088323` industrial cheese 96 · `Q746471` blue cheese 96 · `Q1411808` sheep milk cheese 88 ·
`Q2213488` pressed uncooked cheese 77 · `Q1531597` raw-milk cheese 71 · `Q19361017` British cheese 70 ·
`Q1256296` white mould-rind cheese 69 · `Q3774485` washed-rind cheese 66 · `Q3323634` fresh cheese 57 ·
`Q19341731` pasteurised milk cheese 40 · `Q1412505` pasta filata 37 · `Q3088326` natural-rind soft
cheese 36 · `Q1570052` processed cheese 35 · `Q3088330` pressed cooked cheese 32 · `Q16637316` soft
cheese 28 · `Q1412674` granular cheese 22 · `Q5620025` brined cheese 10

This is a French-Wikipedia-derived taxonomy that **collapses at least five orthogonal axes into one
property**: nationality (French/Italian/British), milk (cow's-milk/goat), production scale
(farmstead/industrial), paste treatment (pressed cooked/uncooked/half-cooked, pasta filata), and
rind (washed/white-mould/natural). It is not an enum. It is raw material from which one or two
enums can be *derived*, by picking a whitelist of Q-ids per axis and dropping the rest.

---

## Field mapping onto `AttributeDef`

The descriptor shape from [#46](https://github.com/AppElent/gather/issues/46) is
`{ id, label, type: 'text' | 'number' | 'enum', options?, unit? }`, living at
`convex/lib/tasting/kinds.ts` (not yet created).

| `AttributeDef` id | `type` | Source | Vocabulary | Coverage |
| --- | --- | --- | --- | --- |
| `country` | `enum` | `P495` | Wikidata country items → ISO-ish enum. ~40 distinct values in the union, heavily concentrated. Genuine controlled vocabulary. | 87% |
| `milk` | `enum` | `P186`, whitelisted to Q10988133 / Q2736146 / Q1418287 / Q7224064 / Q1912004 | Clean 4–5 value enum: `cow` / `sheep` / `goat` / `buffalo` / `mixed` (multiple values → `mixed`) | 38% |
| `family` | `enum` | `P279`, whitelisted to the rind/paste classes | `blue` / `washed-rind` / `bloomy-rind` / `fresh` / `pressed` / `pasta-filata` / `processed`. Derived, needs a hand-picked Q-id→option map. | ~35% at best, and only after discarding the nationality and scale classes |
| `pasteurised` | `enum` | `P279` → Q1531597 / Q19341731 | Three-valued: `raw` / `pasteurised` / unknown | **5%** (111 of 2069) |
| `designation` | `enum` | `P1389` | `PDO` / `PGI` / `AOC` / `TSG` / `PAT`. Note the value set is duplicated in Wikidata — Q13439060 and Q587378 are both "protected designation of origin"/"denominazione di origine protetta", Q3104453 and Q3150363 are both "protected geographical indication" — so the map must fold synonyms. | 37% |
| `fatContent` | `number`, `unit: '%'` | **nothing** | — | **0%** |
| `texture` | `enum` | **nothing directly** | Only inferable from the `family` classes | **0%** |
| `description` | `text` | `schema:description` @en | free text, one line | 74% |

**What has a real controlled vocabulary**: country, milk, designation. Those three become `enum`
options with confidence, because the underlying values are Wikidata items with stable Q-ids rather
than free strings, and their distributions are short and concentrated.

**What has a vocabulary only after human curation**: family. The Q-ids are stable, but choosing
which of them are "the families" and which are noise is an editorial act, not a mapping.

**What Wikidata cannot give us**: fat content and texture, at all, and pasteurisation for 95% of
rows. If the descriptor declares these attributes, they will be empty in every seeded row and
filled only by whoever adds a subject by hand. That is a legitimate design — an `AttributeDef` the
Catalog leaves blank and a person fills in is exactly what a user-created subject is for — but it
should be a decision rather than a surprise discovered when the fixture lands.

---

## Images

`P18` is present on 835 of 2069 union items, and 288 of the 347 "complete" rows carry one. **Its
value is a Wikimedia Commons filename, and Wikidata's CC0 does not extend to the file.**
Commons is explicit that licensing is per-file: "Each media file has its licensing specified on its
file description page", reusers must "Confirm that the file is available under license terms that
suit you", and "the Wikimedia Foundation does not provide any warranty regarding the copyright
status"
([Commons:Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)).
Individual files range across CC0, CC BY, CC BY-SA and various public-domain tags
([Commons:Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing)).

So for a CC BY or CC BY-SA cheese photograph, displaying it in gather would require carrying the
author's name, the licence identifier, and a link to the licence text, next to the image — per file,
forever, in a UI that has nowhere to put it today. CC BY-SA additionally has a share-alike term that
becomes awkward if the image is ever composited into something.

**The clean answer is to store the `P18` filename in the fixture and render nothing from it in v1.**
The field is CC0 data — a string — and keeping it costs nothing and preserves the option. Turning it
into a picture is a separate decision that has to bring an attribution surface with it.

[ADR-0010](../adr/0010-a-photo-is-stored-as-prepared-never-as-chosen.md) sharpens *which* decision it
is. The ADR distinguishes a photo a person chooses — framed, shrunk, stored prepared — from an image
Gather fetches for itself, which is "neither chosen nor prepared" (`CONTEXT.md`). A Commons image
behind a `P18` filename is squarely the second kind, and the ADR already names the one existing
instance of that: `recipeImport` fetches a remote hero image and stores it as fetched, "accepted as
they come until that is shown to matter". A cheese image would be the second door through that wall,
and unlike a recipe's hero image it would arrive with a legal attribution obligation attached. #43's
open question of "whether photos hang off a subject or off a Rating" is the place to settle it —
noting that a Commons variety photo can only ever hang off the *subject*, since it is a shared fact
about the world and not anyone's encounter with it.

---

## How the fixture gets generated

### Shape

A **one-shot Node script under `scripts/`, run by hand on a developer machine**, that emits
`convex/lib/seed/catalogCheeses.ts` and is then reviewed and committed like any other file.

Not a Convex action, and not CI. The container in which agent sessions run reached
`query.wikidata.org` fine for this note, so the constraint recorded in #51 no longer binds — but that
is not the reason to keep it out of Convex. The reason is that this is a build-time artefact whose
whole point is to be reviewed by a human before it becomes data. A Convex action would write rows
nobody read first; CI would regenerate it on a schedule and produce diffs nobody asked for. Wikidata
changes under us, and a fixture that silently follows it is a fixture whose contents no release ever
approved.

### What it does

1. One SPARQL `SELECT` against `https://query.wikidata.org/sparql` over the union set, projecting
   Q-id, English label, English description, `P495`, `P186`, `P279`, `P1389`, `P18`, sitelink count,
   and the enwiki article — with `LIMIT`/`OFFSET` paging, a descriptive `User-Agent`, and a courtesy
   delay, per the
   [WDQS user manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual).
2. Filter to the ~347 rows carrying enwiki ∧ `P495` ∧ a whitelisted `P186`.
3. Fold Q-ids through hand-maintained maps — `MILK_BY_QID`, `FAMILY_BY_QID`, `DESIGNATION_BY_QID`,
   `COUNTRY_BY_QID` — into the descriptor's `enum` option strings, **dropping rows whose values are
   not in the map rather than passing unknown values through**, since #46 established that unknown
   attribute keys are rejected rather than silently dropped.
4. Assign each row a stable `seedKey` derived from its Q-id (`cheese-wd-Q217525`), so ADR-0004's
   reconciliation has something durable to key on that survives a rename.
5. Emit a formatted TypeScript module, then run Biome over it.

The maps in step 3 are the deliverable that actually takes human time. The fetching is trivial; the
editorial judgement about which of `Q3088318` "farmstead cheese" and `Q2223649` "French cheese" is a
*family* is not.

### Its end condition

`CLAUDE.md` requires one-shot code to state where it lives what would retire it. This script's is:

> **Retired when the emitted fixture is next regenerated, or when the Catalog cheese path is
> removed. It is re-run by hand, never on a schedule, and never in CI. If a year passes with no
> re-run, delete it — the fixture it produced is the artefact, and a generator nobody has run since
> the last release is a liability that looks like a capability.**

The script is not migration code and not a compatibility shim; it is a generator. But it has the same
failure mode the `legacyPaths.ts` cautionary tale describes — excellent about why it exists, silent
about when it stops — so it gets the same treatment.

### When any of this is actually needed

**Not for v1.** [#49](https://github.com/AppElent/gather/issues/49) decided that v1 ships **Sample
household fixtures only** and that `seedCatalog` gains **no** cheese path — every cheese row in v1 is
user-created. That decision also recorded the consequence this note inherits: *"Catalog reconciliation
wiring for subjects does not exist yet. Whoever does the data work builds the `seedCatalog` path
**and** the fixture, not just the fixture."*

So the ordering is:

1. **v1 (now):** `SAMPLE_CHEESES` in `convex/lib/seed/sampleHousehold.ts`, ~6 hand-written subjects.
   Nothing from this note is needed — and the six sample cheeses should be *hand-written*, not
   generated, because a sample household wants recognisable everyday cheeses and disagreeing
   housemates, which no query produces.
2. **Later:** `seedCatalog` grows a `tastingSubjects` reconciliation path, keyed by `seedKey` and
   obeying ADR-0004 (seed always wins, retired fixtures deleted, rows without a `seedKey` untouched).
   *That* is when the generation script gets written and the ~347-row fixture lands, and it should
   land in the same change as the reconciliation path so the path is exercised by real data on its
   first day.
3. `#43`'s open question — *"what the module does on a fresh production install with no Catalog"* —
   is answered by step 2 arriving, or needs its own first-run treatment if it does not.

---

## The queries, verbatim

Re-runnable at [query.wikidata.org](https://query.wikidata.org/). All results above were obtained
by GETting `https://query.wikidata.org/sparql?query=<urlencoded>&format=json`.

**Set sizes.**

```sparql
SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c wdt:P31 wd:Q10943 }
SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c wdt:P31/wdt:P279* wd:Q10943 }
SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c wdt:P279* wd:Q10943 }
```

**Property census — what fields exist at all.** Run once as written, once with `OFFSET 45`, to
reach properties used on a single item.

```sparql
SELECT ?p ?pLabel (COUNT(DISTINCT ?c) AS ?n) WHERE {
  ?c wdt:P31/wdt:P279* wd:Q10943 .
  ?c ?prop ?v .
  ?p wikibase:directClaim ?prop .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?p ?pLabel
ORDER BY DESC(?n)
LIMIT 45
```

**Joint completeness over the union — the headline numbers.**

```sparql
SELECT
  (COUNT(?c) AS ?total)
  (SUM(IF(?nen>0,1,0)) AS ?hasEnwiki)
  (SUM(IF(?s>=5,1,0)) AS ?sitelinks5plus)
  (SUM(IF(?s>=10,1,0)) AS ?sitelinks10plus)
  (SUM(IF(?nco>0,1,0)) AS ?country)
  (SUM(IF(?nmilk>0,1,0)) AS ?milk)
  (SUM(IF(?ni>0,1,0)) AS ?image)
  (SUM(IF(?nen>0 && ?nco>0 && ?nmilk>0,1,0)) AS ?enwikiCountryMilk)
  (SUM(IF(?nen>0 && ?nco>0 && ?nmilk>0 && ?ni>0,1,0)) AS ?allFour)
WHERE {
  {
    SELECT ?c ?s
      (COUNT(DISTINCT ?a) AS ?nen)
      (COUNT(DISTINCT ?co) AS ?nco)
      (COUNT(DISTINCT ?m) AS ?nmilk)
      (COUNT(DISTINCT ?i) AS ?ni)
    WHERE {
      { ?c wdt:P31/wdt:P279* wd:Q10943 } UNION { ?c wdt:P279+ wd:Q10943 } .
      ?c wikibase:sitelinks ?s .
      OPTIONAL { ?a schema:about ?c ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?c wdt:P495 ?co }
      OPTIONAL {
        ?c wdt:P186 ?m .
        VALUES ?m { wd:Q10988133 wd:Q2736146 wd:Q1418287 wd:Q7224064 wd:Q1239497 }
      }
      OPTIONAL { ?c wdt:P18 ?i }
    }
    GROUP BY ?c ?s
  }
}
```

Replacing the `UNION` line with `?c wdt:P31/wdt:P279* wd:Q10943 .` gives the instance-branch-only
figures (130 / 109) quoted above.

**Label, description, cross-reference and pasteurisation coverage over the union.**

```sparql
SELECT
  (COUNT(?c) AS ?total)
  (SUM(IF(?nd>0,1,0)) AS ?enDesc)
  (SUM(IF(?nea>0,1,0)) AS ?eAmbrosia)
  (SUM(IF(?nta>0,1,0)) AS ?tasteAtlas)
  (SUM(IF(?nraw>0,1,0)) AS ?rawMilkClass)
  (SUM(IF(?npast>0,1,0)) AS ?pasteurisedClass)
  (SUM(IF(?nce>0,1,0)) AS ?cert)
WHERE {
  {
    SELECT ?c
      (COUNT(DISTINCT ?d) AS ?nd) (COUNT(DISTINCT ?ea) AS ?nea)
      (COUNT(DISTINCT ?ta) AS ?nta) (COUNT(DISTINCT ?raw) AS ?nraw)
      (COUNT(DISTINCT ?past) AS ?npast) (COUNT(DISTINCT ?ce) AS ?nce)
    WHERE {
      { ?c wdt:P31/wdt:P279* wd:Q10943 } UNION { ?c wdt:P279+ wd:Q10943 } .
      OPTIONAL { ?c schema:description ?d . FILTER(LANG(?d) = "en") }
      OPTIONAL { ?c wdt:P9854 ?ea }
      OPTIONAL { ?c wdt:P5456 ?ta }
      OPTIONAL { ?c wdt:P279 ?raw . VALUES ?raw { wd:Q1531597 } }
      OPTIONAL { ?c wdt:P279 ?past . VALUES ?past { wd:Q19341731 } }
      OPTIONAL { ?c wdt:P1389 ?ce }
    }
    GROUP BY ?c
  }
}
```

**Vocabulary distributions.** Swap `wdt:P186` for `wdt:P279`, `wdt:P495` or `wdt:P1389` to get the
family, country and designation value sets.

```sparql
SELECT ?m ?mLabel (COUNT(DISTINCT ?c) AS ?n) WHERE {
  { ?c wdt:P31/wdt:P279* wd:Q10943 } UNION { ?c wdt:P279+ wd:Q10943 } .
  ?c wdt:P186 ?m .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?m ?mLabel
ORDER BY DESC(?n)
LIMIT 20
```

**Which branch a given cheese is in** — the check that produced the Cheddar table.

```sparql
SELECT ?c ?cLabel ?inP31Set ?inP279Set WHERE {
  VALUES ?c { wd:Q217525 wd:Q593675 wd:Q193411 wd:Q155922 wd:Q14088
              wd:Q131480 wd:Q189221 wd:Q932214 }
  BIND(EXISTS { ?c wdt:P31/wdt:P279* wd:Q10943 } AS ?inP31Set)
  BIND(EXISTS { ?c wdt:P279+ wd:Q10943 } AS ?inP279Set)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
```

**Most recognisable cheeses, by sitelink count** — the candidate list for hand-picking the six
Sample household subjects.

```sparql
SELECT ?c ?cLabel ?s WHERE {
  { ?c wdt:P31/wdt:P279* wd:Q10943 } UNION { ?c wdt:P279+ wd:Q10943 } .
  ?c wikibase:sitelinks ?s .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?s)
LIMIT 35
```

Top of that list, for reference: mozzarella (76 sitelinks), Parmesan (71), Camembert (66), feta (62),
brie (60), Gorgonzola (60), Cheddar (60), Gouda (60), Emmental (60), Roquefort (59), ricotta (59),
mascarpone (56), Gruyère (54), Edam (51), paneer (51).

---

## Gaps

Four things could not be read directly and are flagged rather than papered over.

**cheese.com's terms page could not be fetched.** Every automated request to `cheese.com` — root,
`/about/`, `/robots.txt`, `/cheese-gifts/terms/` — returned nothing, consistent with bot protection.
The copyright sentence quoted above came through a search engine's index of that page rather than
from the page itself. The recommendation does not depend on it: absent an affirmative grant the
default is all rights reserved, and no grant exists on any reading. But if anyone wants the primary
source, it needs a human with a browser.

**Kaggle's Terms of Use could not be fetched** (JavaScript-rendered; WebFetch got the page title
only), so the claim that Kaggle's licence dropdown is an uploader assertion rather than a validated
grant rests on the general principle that one cannot license what one does not own, not on a quote
from Kaggle. The individual dataset pages are also JS-rendered and their declared licence fields were
read from search-result summaries rather than the pages.

**Open Food Facts' search API returned HTTP 503** throughout, so the number of cheese *products* in
OFF is unmeasured. The terms and data pages loaded fine, so the licence findings for OFF are
first-hand; only the volume figure is missing, and it does not bear on the recommendation.

**GIview has no readable terms page** — it is a single-page app that serves an empty shell to a
fetcher. Its licence is inferred from the eAmbrosia dataset record on data.europa.eu and the
Commission's general reuse notice, both of which were read directly. If GIview is ever used as a
source rather than a reference, confirm its own terms first, since EUIPO operates it jointly with the
Commission and may attach its own.
