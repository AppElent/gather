# Recipes — Ratings, Photos, and URL Import Design

**Date:** 2026-07-14
**Status:** Approved (design); ready for implementation planning
**Scope:** Extends the existing Recipes module (see
[2026-06-21-gather-shell-design.md](2026-06-21-gather-shell-design.md)) with a polished star-rating
widget, a switchable photo-forward card layout for the recipe list, and importing a recipe from an
external URL. Per-person ratings/averaging, OS-level share-target integration, and surfacing
`prepMinutes` in the UI are explicitly out of scope for this pass.

---

## 1. Context

Recipes today (`convex/recipes.ts`, `convex/schema.ts`, `src/routes/_app/recipes/*`,
`src/components/recipes/RecipeForm.tsx`) support create/read/update/delete with an optional photo,
a single 1–5 `rating` number set by the recipe's owner, tags, and group sharing via the existing
`ownerId` / `sharedGroupIds` / `isVisibleTo` model. The list view doesn't show photos at all, rating
is a raw number input, and there's no way to pull a recipe in from a website instead of typing it in
by hand.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Rating model | Single rating per recipe, owner-set (unchanged) — UI polish only |
| Rating input | Clickable 5-star widget, replaces the numeric `<input>` |
| Card layout | Three switchable views (Grid / Banner / Compact), user preference in `localStorage` |
| URL import parsing | `schema.org/Recipe` JSON-LD first; Claude (Anthropic) fallback if absent |
| Import execution | Convex action (not a TanStack Start server route) — see §5 |
| Import review | Prefills the New Recipe form; user reviews/edits before Save (never auto-saves) |
| Import entry points | An "Import from URL" box on `/recipes/new`, and `?url=` query param support |
| Anti-bot handling | Honest browser `User-Agent` + timeout; blocked/failed fetch degrades to manual entry — no evasion techniques |

---

## 3. Ratings

No schema change — `recipes.rating` stays as-is. [RecipeForm.tsx](../../../src/components/recipes/RecipeForm.tsx)
replaces its numeric rating `<input type="number">` with a 5-star clickable widget (click star *n*
sets `rating = n`; clicking the currently-set star clears it back to `undefined`). List and detail
views keep rendering `'★'.repeat(rating)` as they do today — only the input changes.

---

## 4. Recipe photos & switchable card views

### 4.1 Data

`recipes.list` (in [recipes.ts](../../../convex/recipes.ts)) currently returns raw recipe documents
without resolving `imageId` to a URL — only `get` does that. `list` needs to do the same
`ctx.storage.getUrl(imageId)` resolution per recipe so the list page can render thumbnails.

### 4.2 UI

The recipe list page gets a small view-mode toggle (three icon buttons) above the grid. Three
layouts, same underlying card data (`title`, `rating`, `tags`, `imageUrl`):

- **Grid** (default) — fixed-height photo banner on top, title/stars/tags stacked below.
- **Banner** — taller card, photo fills the tile, title/stars overlaid at the bottom on a gradient
  scrim.
- **Compact** — small square thumbnail + title/stars/tags in a row; fits more recipes per screen,
  best on mobile.

Recipes without a photo render a plain placeholder tile in all three modes (no broken image, no
layout shift). The selected mode is stored client-side in `localStorage` under
`gather.recipes.viewMode` — per-device, no backend change, no new Convex field.

---

## 5. URL import

### 5.1 Schema

Add one optional field to `recipes`:

```ts
sourceUrl: v.optional(v.string())
```

Set when a recipe is created via import; left unset for manual entries. Shown on the detail page as
a small "Imported from example.com" link.

### 5.2 Why a Convex action, not a TanStack Start server route

All of this app's domain/auth logic already lives in `convex/` — `getCurrentUser`,
`getMyGroupIds`, and `isVisibleTo` in [lib/sharing.ts](../../../convex/lib/sharing.ts) are the
established way to resolve the signed-in user and their sharing scope. A Start server route would
either duplicate that Clerk-JWT resolution or call back into Convex to do it, adding a second
backend surface for one feature. A Convex **action** can do the whole job in one authenticated hop:
`fetch()` the external page, call the Anthropic API, and call `ctx.storage.store()` directly to save
the fetched image server-side — no client-upload round trip needed, unlike the existing
`generateUploadUrl` flow (which exists for client-originated uploads). The new `ANTHROPIC_API_KEY`
secret also lives in Convex env vars, the same mechanism already used for `CLERK_JWT_ISSUER_DOMAIN`.

### 5.3 `recipes.importFromUrl` action

Input: `{ url: string }`. Steps:

1. Require an authenticated user (same `getCurrentUser` check as the rest of `recipes.ts`).
2. `fetch(url)` with a realistic browser `User-Agent` header and a reasonable timeout.
   - **Fetch fails or is blocked** (network error, non-2xx, bot-block/challenge page): return a
     distinct error — *"That site blocks automated access — try pasting the recipe manually."* No
     retries via proxies, no CAPTCHA-solving, no fingerprint spoofing.
3. On a successful fetch, look for a `<script type="application/ld+json">` block whose parsed JSON
   is (or contains, per the JSON-LD spec's array/`@graph` forms) a `schema.org/Recipe`. If found,
   map its fields directly — this covers the majority of recipe blogs, since sites publish this
   markup specifically so Google's crawler (a plain HTTP fetch, same as ours) can read it for rich
   snippets.
4. If no JSON-LD `Recipe` is found, strip the HTML to visible text (bounded length) and send it to
   Claude via `@tanstack/ai-anthropic` with a structured-extraction prompt, requesting the same
   shape as step 3. If the model can't find a recipe either, return a
   *"Couldn't find a recipe on that page — try pasting the details manually"* error.
5. Whichever path succeeds, if an image URL was found, fetch those bytes server-side and
   `ctx.storage.store()` them, producing a `storageId`.
6. Return `{ title, description?, ingredients: string[], steps: string[], tags: string[],
   prepMinutes?, imageId?, imageUrl?, sourceUrl: url }` to the client. **Nothing is written to the
   `recipes` table yet.**

### 5.4 Frontend flow

- `/recipes/new` gets an "Import from URL" box above the existing [RecipeForm](../../../src/components/recipes/RecipeForm.tsx).
  Submitting a URL calls `importFromUrl`, shows a loading state, and on success prefills the form
  fields below (including the fetched image and the hidden `sourceUrl`) — the user reviews/edits
  exactly like manual entry, then hits the existing Save. On error, the box shows the inline error
  message from §5.3 and the form stays empty for manual entry; import never blocks recipe creation.
- The route accepts a `?url=<encoded-url>` search param: on load, if present, it prefills the import
  box and immediately triggers the fetch — for pasting a link directly into the address bar (or a
  future share-target redirect) instead of typing into the box. No PWA/manifest/share_target work is
  included in this pass (see Out of scope).

---

## 6. Testing

- `RecipeForm`: star widget sets/clears `rating` correctly (extends existing
  [RecipeForm.test.tsx](../../../src/components/recipes/RecipeForm.test.tsx)).
- Card view toggle: switching modes updates rendering and persists to `localStorage`.
- `recipes.list`: returns `imageUrl` for recipes with and without a photo.
- `recipes.importFromUrl`: JSON-LD path (mocked fetch with a `Recipe` script tag), AI-fallback path
  (mocked fetch with no JSON-LD, mocked Anthropic response), and both failure modes (fetch
  blocked/errors; no recipe found by either path) — each returns the right shape or the right error,
  and never writes to the database.
- `/recipes/new`: `?url=` param triggers import on load; successful import prefills the form; a
  failed import leaves the form usable for manual entry.

---

## 7. Out of scope (this pass)

- Per-person ratings and averaging (kept as a possible future project — would need a new `ratings`
  table keyed by recipe + user).
- OS-level "Share → Gather" via a PWA manifest/`share_target`/service worker — this app has none of
  that infrastructure yet; the `?url=` query param is the integration point a future share-target
  redirect would use.
- Surfacing the existing unused `prepMinutes` schema field in the UI.
