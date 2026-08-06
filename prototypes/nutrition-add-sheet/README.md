# Prototype — the Nutrition add sheet

**Throwaway. This branch is a primary source, not code to merge.** Nothing here is
production code: it was written under prototype rules — no tests, no error handling
beyond what makes it run, mock data, one file. Do not promote it. The validated
decisions live in the spec, and the real implementation gets written properly.

- **Question it answered:** what should adding food look like on a phone, now that
  the dialog-with-three-tabs is unusable there?
- **Spec it fed:** AppElent/gather#63
- **Verdict:** variant **B — inspect first** won.
- **Built:** 2026-08-06, during the design conversation that produced #63.

## How to look at it

Open `sheet-variant-b-refined.html` in a browser. No build, no server, no
dependencies — it is one self-contained file. It is worth opening on an actual
phone; the whole point was a gesture you cannot judge from a screenshot.

## The three variants

All three shared the same draggable three-detent sheet (peek / full / closed) so
the *feel* was held constant and only the information design varied. They
disagreed on one thing deliberately: the **primary affordance**.

### A — One-tap list *(rejected)*

The list was the product. Combos, then Recent, then Most-often, as a flat list of
rows. Tapping a row logged it immediately at its default serving and closed the
sheet, with an Undo toast. Tapping the row's *thumbnail* instead opened serving
chips.

Rejected because it commits before you have seen anything. Undo softens it but
does not fix it: a food you have not logged before has no trustworthy default
serving, so one-tap is fast precisely when it is least safe.

### B — Inspect first *(chosen)*

Rows are cards that expand in place into serving chips plus a full macro
breakdown, with an explicit Add. Two taps minimum, always.

Chosen because seeing the amount and the nutrition before committing is the
normal case, not the careful case — and because it is the only variant where
"which of these two similar products is it" is answerable without leaving the
flow.

### C — Basket builder *(rejected)*

Items accumulated in a docked footer showing a running kcal total, committed in
one action, with **Save as combo** offered right there.

Rejected as the default, but it contributed the strongest single idea: combos
being born out of something you were already doing. That survives in the spec as
"Save as…" on a filled-in meal slot rather than a combo builder. The basket
itself lost because it adds a staging concept to every interaction in order to
serve the minority that log several things at once.

## What exercising it changed

Two decisions came from *driving* the winner on a phone, not from designing it.
Both are in the spec:

1. **Combos need the same inspection treatment as everything else.** "Sometimes
   you just want to change something small" turned out to be routine, not an
   edge case. So a combo card expands into its components, each with a stepper
   counting that component's own named serving.
2. **A remove control next to a quantity stepper is redundant.** The first draft
   had both a `−/+` stepper and an `✕` per component. On a 390px screen they were
   both too small *and* doing the same job — stepping to zero already means
   removed. Dropping the `✕` freed the room to make the stepper a proper 44px
   target. A sizing complaint exposed a design smell.

A third finding was a plain bug worth carrying into the real build: **inputs below
16px make iOS Safari zoom the page on focus.** Fixed by font size, not by
`maximum-scale`, which would disable pinch-zoom for everyone.

## Honest note on what is missing

**Variants A and C are not in this file.** The prototype was iterated *in place* —
when B won, the multi-variant file was overwritten with the refined B rather than
copied aside first. That is exactly the loss this capture step exists to prevent,
and it happened anyway.

They are recoverable from the published artifact's version history, under the
version labelled `three-sheet-variants` (the same artifact URL; later versions are
`variant-b-refined` and `mobile-tap-targets`). The descriptions above carry the
decision-relevant content, which is what the record actually needs — but the
literal code of the rejected variants is one version-picker click away rather than
here, and that is a worse outcome than it should have been.

Next time: branch the capture *before* refining the winner.

## Fidelity caveats

- Data is mock and hardcoded — real Dutch supermarket products, made-up figures.
- Thumbnails are emoji standing in for real product images. The spec's decision is
  that images come from Open Food Facts at import time.
- Serving lists are handwritten per food. Where they come from for real — Catalog
  fixtures, the OFF import, and your own logging history — is a spec decision, not
  something this prototype models.
- Nothing persists. Reloading resets it.
