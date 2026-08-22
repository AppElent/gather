# A Tasting catalog is a picker, and tasting it makes it yours

Status: decided (2026-08-22), not yet implemented

The tasting Modules — Cheeses, Wines, Beers — need somewhere for "Gouda" to come
from. Gather already has an answer to that question, and it is the wrong one
here.

**Foods** ships a Catalog: read-only rows reconciled by `seedKey`, which the
seed always wins over, and which every diary entry in every Group references
directly ([ADR-0004](0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)).
Copying that shape for cheeses is the obvious move, and it fails on two things a
Food never had to survive.

**We chose the other shape. The Tasting catalog is a picker: choosing an entry
creates that Group's own Tasting subject, prefilled from it, and nothing ever
points at the shipped row again.** The catalog row's key is kept on the copy as
**Provenance** — checked on read, safe to dangle — and nothing else.

## Why a Food's shape does not fit

**A Tasting subject accumulates a relationship; a Food does not.** A Food is a
fact: a gram of Gouda has that much fat whatever anybody thinks, so a read-only
row shared by everyone is exactly right. A Tasting subject is the thing your
household has opinions about — the photo of the label, the note that you buy the
48-month one, the six Tastings hanging off it. A read-only row can hold none of
that. Under a reference model, the subjects people use *most* — the well-known
ones — would be precisely the ones able to hold the least.

**The seed deletes retired fixtures.** That is ADR-0004's contract and not an
edge case. If `gouda` is later split into `gouda-young` and `gouda-aged`, every
Tasting referencing the old row points at nothing. Provenance is allowed to
dangle — the glossary says so — but the *subject of a Tasting is not
provenance*. It is what you tasted, and a tasting history that has forgotten
what it was of is broken in a way a dangling recipe link is not.

**Corrections would rewrite history.** The upside of referencing is that a fix
we ship reaches every Group. Applied here that means a deploy silently changing
what somebody's 2026 tasting notes were about. That is a cost, not a feature.

## What this buys

One table, one ownership rule. Every list, search, sort, average and photo in
the Module sees `tastingSubjects` rows belonging to the Group, full stop. The
two-shaped problem — shipped things and your things — exists in exactly one
place, the add flow, and nowhere else in the Module.

It also costs nothing at rest: no row exists until a Group has actually tasted
something, so a Group that never opens Cheeses stores nothing, which is the
whole benefit a pure-reference model was offering.

Materialising is idempotent, enforced on `(groupId, kind, catalogKey)`. Tasting
Gouda a second time finds your Gouda; it never makes a second one. Hand-typed
names get no such constraint — two different Barolos from two producers are two
subjects with one short name — so the create flow warns rather than refuses.

## What we are paying

**A correction to a shipped entry never reaches a Group that already copied
it.** A wrong milk type on Gouda is wrong in every household that tasted it
before the fix. Accepted deliberately: the alternative is a deploy editing
records people wrote.

**Two catalogs now exist with opposite rules**, and a reader who knows Foods
will guess wrong about cheeses. That is what the standing rule in `CONTEXT.md`
is for: a Catalog entry is either a *fact* (referenced, read-only forever) or a
*suggestion* (copied, then irrelevant), and which one it is has to be said out
loud per catalog.

## Where the catalog lives

**In Convex, seeded, uncached** — not bundled into the client, which was the
alternative considered. At the sizes involved (~40 cheeses; `catalogFoods.ts` is
33 entries in 14KB) a bundle would be free and would need no seed apparatus at
all. Convex was chosen anyway, to keep two doors open: a client-side cache can
be added later without moving the data, and entries could one day be contributed
by households rather than authored by us — which a bundle makes impossible.

The price is the seed machinery ADR-0004 governs, and a
`convex run seed:seedTastingCatalog` line beside the existing one in
`deploy:dev` and `deploy:prod`.

**Kind vocabularies are not part of this.** Grape varieties, regions, styles and
aroma descriptors ship in `packages/core` alongside the Kind specs, because they
are field options rather than subjects — every Kind has them, including the two
with no catalog at all.
