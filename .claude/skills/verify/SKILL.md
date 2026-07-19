---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck. Run before committing nontrivial changes to gather.
---

# Verify (gather)

Local-first. On web (no dev server / no Convex+Clerk runtime creds), fall back to the
static suite: `pnpm run typecheck`, `pnpm run check`, `pnpm test`, `pnpm build`.

## Route → module map

Routes live under `src/routes/` (file-based, TanStack Router). `src/routes/_app.tsx` is
the authenticated shell; `src/routes/_app/*` are its child routes. Module metadata
(label, group, status) lives in `src/lib/modules.ts`.

| Route | File | Module status |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | landing |
| `/about` | `src/routes/about.tsx` | static |
| `/sign-in` | `src/routes/sign-in.tsx` | auth |
| `/sign-up` | `src/routes/sign-up.tsx` | auth |
| `/forgot-password` | `src/routes/forgot-password.tsx` | auth |
| `/dashboard` | `src/routes/_app/dashboard.tsx` | live |
| `/recipes` | `src/routes/_app/recipes/index.tsx` | live |
| `/recipes/new` | `src/routes/_app/recipes/new.tsx` | live |
| `/recipes/$recipeId` | `src/routes/_app/recipes/$recipeId.index.tsx` | live |
| `/recipes/$recipeId/edit` | `src/routes/_app/recipes/$recipeId.edit.tsx` | live |
| `/foods` | `src/routes/_app/foods/index.tsx` | live (no dashboard tile) |
| `/foods/new` | `src/routes/_app/foods/new.tsx` | live (no dashboard tile) |
| `/foods/$foodId` | `src/routes/_app/foods/$foodId.index.tsx` | live (no dashboard tile) |
| `/foods/$foodId/edit` | `src/routes/_app/foods/$foodId.edit.tsx` | live (no dashboard tile) |
| `/nutrition` | `src/routes/_app/nutrition/index.tsx` | live |
| `/meal-planner` | `src/routes/_app/meal-planner.tsx` | placeholder |
| `/groceries` | `src/routes/_app/groceries.tsx` | placeholder |
| `/pantry` | `src/routes/_app/pantry.tsx` | placeholder |
| `/finances` | `src/routes/_app/finances.tsx` | placeholder |
| `/bills` | `src/routes/_app/bills.tsx` | placeholder |
| `/tasks` | `src/routes/_app/tasks.tsx` | placeholder |
| `/calendar` | `src/routes/_app/calendar.tsx` | placeholder |
| `/notes` | `src/routes/_app/notes.tsx` | placeholder |
| `/cheeses` | `src/routes/_app/cheeses.tsx` | placeholder |
| `/wines` | `src/routes/_app/wines.tsx` | placeholder |
| `/groups` | `src/routes/_app/groups.tsx` | live |
| `/account` | `src/routes/_app/account.tsx` | live |
| `/settings` | `src/routes/_app/settings.tsx` | live |

Convex backend functions: `convex/recipes.ts`, `convex/groups.ts`, `convex/users.ts`,
`convex/foods.ts`, `convex/foodsLookup.ts`, `convex/consumption.ts`, `convex/lib/sharing.ts`,
`convex/lib/offMapping.ts`, `convex/lib/offFetch.ts`, `convex/lib/consumption.ts`.

## Auth note

The sign-in screen's "▶ Dev: log in as test user" button comes from `@appelent/auth`'s
`TestLoginButton` and appears only when `VITE_CLERK_PUBLISHABLE_KEY` is a `pk_test_...`
key **and** both `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set. If it's
missing, check `.env.local` before concluding the app can't be tested logged-in.

gather's sign-in flow (`src/routes/sign-in.tsx`) consumes `@appelent/auth`'s
`SignInForm`/`TestLoginButton` directly — the migration off the hand-rolled
Clerk `<SignIn>` has landed.

## What to drive

1. Start the dev server (`.claude/launch.json` → `dev:watch`, needs both Convex and Vite).
2. Log in via the test-login button (see above) or an already-authenticated session.
3. For a change to a `live` route (Recipes, Groups, Account, Settings): exercise the
   actual CRUD flow the change touches — create/edit/delete a recipe, join/leave a
   group, etc. — not just a page load.
4. For a change to a `placeholder` route: confirm it still renders the placeholder
   shell without erroring (`src/components/app/ModulePlaceholder.tsx`).
5. Check the browser console and network tab for errors introduced by the change.
