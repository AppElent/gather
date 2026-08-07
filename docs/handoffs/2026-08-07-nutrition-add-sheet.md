# Handoff — the Nutrition add sheet, three defects found on the preview

**Written:** 2026-08-07, from the web session that built PR #72 (branch
`claude/nutrition-redesign-f4ndxw`).

**Delete this file when the three defects below are fixed or filed as issues.**
It is a note between two sessions, not documentation — it describes a moment,
and it will be wrong within days.

## Where things stand

PR **#72** implements #63's eight sub-issues (#64–#71), one commit each. CI is
green: lint, typecheck, both vitest projects (1008 tests) and the build. The
preview is live at **https://gather-pr-72.appelent.workers.dev** with a `pr-72`
Convex deployment seeded by `seed:seedPreview` — which does run `applyCatalog`
(`convex/seed.ts:61`), so all 31 Catalog foods exist there with `searchText`
populated.

**Nothing on this branch has been driven in a browser.** The web session could
not: Chromium is installed but every external HTTPS navigation from it is reset
at the sandbox boundary (localhost works, `curl` to the same URL returns 200).
So the component tests and the build are the *only* evidence behind every UI
claim in the PR. The three defects below were found by a human on a phone, in
the first few minutes of use, which tells you roughly how much that evidence was
worth for interaction work.

## Defect 1 — dragging and scrolling fight each other; the page behind scrolls

Reported: "sheet dragging/scrolling is HORRIBLE. It scrolls the page behind
sometimes, sometimes not."

Two separate causes, both in `src/components/nutrition/BottomSheet.tsx`.

**a. Nothing locks the page behind the sheet.** There is no scroll lock
anywhere — no `overflow: hidden` on `body`, no fixed-body technique, nothing.
The sheet is a `fixed inset-0 z-50` layer over a page that remains perfectly
scrollable, so any gesture the sheet does not claim reaches the diary
underneath. The "sometimes" in the report is the giveaway: it depends on
whether the pointer landed somewhere the sheet's own handlers took.

**b. The list's `touch-action` hands the gesture to the browser.** The scroll
container is `touchAction: 'pan-y'` (line 215) while the sheet shell is
`touchAction: 'none'` (line 194). The drag is implemented with pointer events
and a `passive: false` `pointermove` that calls `preventDefault()` (lines
144–162) — but once the browser has claimed a vertical pan because
`touch-action` permitted it, `preventDefault` on a *pointer* event does not take
it back. So on touch the browser scrolls and the sheet translates at the same
time. There is also no `setPointerCapture`, so a fast drag that leaves the
element loses its move events.

The `scrollTop > 0` check at line 110 decides gesture ownership once, at
`pointerdown`, from the list's scroll position alone. That is too early and too
little: it cannot know the direction of travel yet. The usual shape is to decide
on the *first move* — direction plus scroll position — and to set
`touch-action: none` on the scroller while the sheet owns the gesture.

Worth reading before changing anything: the prototype
(`prototypes/nutrition-add-sheet/sheet-variant-b-refined.html` on branch
`prototype/nutrition-add-sheet`) is a *single page* with no scrolling document
behind it, which is exactly why this class of bug never appeared there. The
detents, thresholds and velocities it validated are still right; its containment
model is not transferable.

## Defect 2 — focusing the search field pushes it out of sight

Reported: "focusing text field removes the input field out of sight."

`BottomSheet.tsx:188` sizes the sheet `h-[92vh]` and pins it to `bottom-0`.
`vh` is the *layout* viewport: it does not shrink when the software keyboard
opens. Focusing the search field also promotes the sheet to full
(`promoteToFull`, lines 75–78), so the sheet is at its tallest at the exact
moment the visible area is at its shortest, and the header — which is where the
search input lives — ends up above the visual viewport.

Directions, roughly in order of how much they cost:

- `dvh` instead of `vh` gets the common case for free on modern iOS/Android.
- The `VisualViewport` API (`resize` + `offsetTop`) is what actually tracks the
  keyboard, and is the honest fix if `dvh` proves not enough.
- Consider whether promoting to full on focus is even right once the keyboard is
  open; peek plus keyboard may be the better resting state.

## Defect 3 — no foods in the list, only Recipes and Combos

Reported: "i cant see foods in the list (only recipes and combos)."

**This is most likely working as built, and what was built is wrong.** In
`src/components/nutrition/AddSheet.tsx`, Combos (line 323) and Recipes (line
364) render from queries that return everything, so they appear with an empty
search box. Foods come from `search.results` (line 244), and `foods.search`
returns `[]` for an empty term (`convex/foods.ts`) — so the "Your foods" section
(line 350) is *absent until you type*, which reads exactly like a broken list.

**First thing to check on the preview: type three or more characters** (e.g.
`melk`, `brood`, `banana`).

- Foods appear → the data and the index are fine, and this is the design gap
  below.
- Still nothing → then it is real. Check `searchText` on `foods` rows in the
  `pr-72` Convex dashboard; the index moved from `search_by_name` to
  `search_by_text` in #67 and a row without `searchText` matches nothing.

The design gap: #63 says the sheet should open "already showing your Combos and
your recent foods", and **recent foods were never implemented**. I scoped them
out while building #66 because no acceptance criterion demanded them, and left
the empty-search state showing Combos plus every Recipe. That was the wrong
call — it is the first screen of the flow and it looks broken. The pieces to
build it from already exist: `consumption.loggedAmountsForFood` proves the index
pattern, and a `by_user_food` index is already on `consumptionEntries`; what is
missing is a query for *distinct recent foods* rather than amounts for one food.

## Running it locally

```sh
pnpm install
pnpm dev:watch          # Convex watch + Vite
```

Needs `.env.local` (see `.env.example`) with `VITE_CLERK_PUBLISHABLE_KEY`,
`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, and the two `VITE_TEST_USER_*` values
for the dev login button. `pnpm seed:sample` rebuilds the Sample household —
including the two Combos added in #70, which is what you want on screen for
defect 1.

The add sheet is at `/g/<slug>/nutrition/add?date=YYYY-MM-DD&meal=lunch`, and
the diary underneath it is the layout route `nutrition.tsx`, not `index.tsx`.

## Two decisions still open, unrelated to the above

1. **`docs/migrations/0006-food-servings.md` prescribes an impossible order.**
   It says to run `maintenance:backfillFoodServings` before the deploy that
   removes `servingSize`/`servingLabel` — but that mutation ships *in* that same
   Convex push, which the legacy rows reject. Codex caught this
   (PR #72, P1). The owner's decision was to clear the `foods` table instead,
   since prod holds nothing worth keeping: clear it from the Convex dashboard
   (no deployed code needed, which is what breaks the deadlock), then deploy —
   `deploy:prod` re-seeds all 31 Catalog fixtures immediately afterwards. **The
   document has not been rewritten yet.**
2. **`.github/workflows/ci.yml` has `push: { branches: [master] }`** while the
   default branch is `main`, so nothing runs on the default branch after a
   merge. One-line fix, nobody has made it.

Also worth knowing: workflows produced no runs at all for this PR until it was
closed and reopened. The `opened` event was simply missed — the actor was
`AppElent` throughout, so it was not a bot-permissions problem.
