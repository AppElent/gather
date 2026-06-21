# Gather — App Shell Design

**Date:** 2026-06-21
**Status:** Approved (design); ready for implementation planning
**Scope:** The application shell only — navigation, the shared data/sharing model, the
placeholder-module pattern, auth integration, and the first real module (Recipes). Each
remaining module gets its own spec → plan → implementation cycle later.

---

## 1. Context

`gather` is the central hub for a two-person household (the user and his wife), scaffolded as a
TanStack Start app. It will eventually contain many independent modules: recipes, meal planner,
groceries, pantry, finances, bills, tasks, calendar, notes, cheese ratings, wine ratings, and more.

We are **not** building all modules now. We are building the shell so that:

1. The full menu exists and looks complete from day one (every module is a consistent placeholder).
2. There is a repeatable pattern for turning a placeholder into a real module.
3. The shared data/sharing model and auth are established once and reused everywhere.
4. One module — **Recipes** — is built for real as the template the rest are cloned from.

### Tech stack (from the scaffold)

TanStack Start (file-based router) · Convex (data, file storage, live sync) · Clerk auth via the
shared `@appelent/auth` package · Cloudflare Workers deploy · Tailwind v4 · Biome · Sentry ·
TanStack Query/Table/Store. The AI add-on dependencies stay (useful later, e.g. recipe import) but
all demo AI code is removed.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Account/data model | Per-user ownership with selective sharing |
| Sharing default | Shared by default, private opt-out |
| Sharing target | **Groups** (a record can be shared with one or more groups, not just one household) |
| Navigation shell | Grouped sidebar + ⌘K command palette |
| Menu scope | 11 feature modules in 4 groups, plus Dashboard, Settings, and Groups; all placeholders except Recipes |
| First real module | Recipes |

---

## 3. Architecture overview

A pathless **authenticated layout route** wraps every module page:

- **Sidebar** — grouped navigation (the 13 modules in 4 groups, plus Settings and Groups).
  Collapses to a drawer on mobile.
- **Topbar** — page title, ⌘K command palette trigger, and the `@appelent/auth` `HeaderUser` menu.
- **Auth guard** — `beforeLoad` on the layout redirects signed-out users to `/sign-in`.

Public routes (landing, sign-in, sign-up, forgot-password) live outside the layout and use the
`@appelent/auth` forms.

---

## 4. Module registry (keystone)

A single config array is the source of truth for the entire menu. The sidebar, the ⌘K palette, and
the dashboard cards all render from it.

```ts
// src/lib/modules.ts
export type ModuleStatus = 'live' | 'placeholder'
export type ModuleGroup = 'Kitchen' | 'Money' | 'Home & life' | 'Tasting'

export interface ModuleDef {
  id: string
  label: string
  icon: string          // lucide-react icon name
  group: ModuleGroup
  path: string
  status: ModuleStatus
  description: string    // used on placeholder pages and dashboard cards
}
```

Full registry (status `live` only for `recipes` initially; everything else `placeholder`):

| Group | Modules |
|---|---|
| Kitchen | Recipes (live), Meal planner, Groceries, Pantry |
| Money | Finances, Bills & subscriptions |
| Home & life | Tasks, Calendar, Notes |
| Tasting | Cheeses, Wines |

Plus standalone entries: **Dashboard** (home), **Settings**, **Groups**.

**Adding a module later = one registry entry + one route file.**

---

## 5. Placeholder pattern

Every not-yet-built module route renders a shared `<ModulePlaceholder>` component (module icon,
title, "Coming soon", and the registry `description`). The menu feels complete immediately. Building
a module means swapping its placeholder route for real routes and flipping its registry `status` to
`'live'`.

---

## 6. Routing

```
src/routes/
  __root.tsx                      providers: Clerk, Convex, AuthConfigProvider, ThemeSync
  index.tsx                       landing → redirect to /dashboard when signed in
  sign-in.tsx                     @appelent/auth SignInForm (+ TestLoginButton in dev)
  sign-up.tsx                     @appelent/auth SignUpForm
  forgot-password.tsx             @appelent/auth ForgotPasswordForm
  _app.tsx                        authed layout: sidebar + topbar + beforeLoad guard + <Outlet/>
  _app/dashboard.tsx              module cards from the registry
  _app/recipes/index.tsx          recipe list
  _app/recipes/$recipeId.tsx      recipe detail
  _app/recipes/new.tsx            create / edit recipe
  _app/meal-planner.tsx           <ModulePlaceholder>
  _app/groceries.tsx              <ModulePlaceholder>
  _app/pantry.tsx                 <ModulePlaceholder>
  _app/finances.tsx               <ModulePlaceholder>
  _app/bills.tsx                  <ModulePlaceholder>
  _app/tasks.tsx                  <ModulePlaceholder>
  _app/calendar.tsx               <ModulePlaceholder>
  _app/notes.tsx                  <ModulePlaceholder>
  _app/cheeses.tsx                <ModulePlaceholder>
  _app/wines.tsx                  <ModulePlaceholder>
  _app/settings.tsx               app + appearance settings (@appelent/auth AppearanceSettings)
  _app/groups.tsx                 manage groups, invite members, set default group
  _app/account.tsx                @appelent/auth ProfilePanel
```

---

## 7. Data model (Convex)

The backbone every future module reuses.

### Tables

```ts
groups: defineTable({
  name: v.string(),
  inviteCode: v.string(),        // partner / members join an existing group with this
  type: v.optional(v.string()), // free label, e.g. "Home", "Family", "Wine club"
}).index('by_inviteCode', ['inviteCode'])

memberships: defineTable({
  groupId: v.id('groups'),
  userId: v.id('users'),
  role: v.union(v.literal('owner'), v.literal('member')),
})
  .index('by_user', ['userId'])
  .index('by_group', ['groupId'])

users: defineTable({
  clerkId: v.string(),
  name: v.string(),
  email: v.string(),
  imageUrl: v.optional(v.string()),
  defaultGroupId: v.optional(v.id('groups')), // group new items are shared with by default
}).index('by_clerkId', ['clerkId'])
```

### Sharing fields on every domain record

```ts
ownerId: v.id('users')
sharedGroupIds: v.array(v.id('groups'))  // [] = private to owner; defaults to [defaultGroupId]
```

- **Shared by default, private opt-out:** on create, `sharedGroupIds` defaults to
  `[user.defaultGroupId]`. The user can clear it (private) or add more groups (share wider).
- **Per-group sharing:** a wine rating can be shared with both "Home" and a "Wine club" group.

### Shared query helper

A single helper resolves the calling user, looks up their group ids (via `memberships.by_user`),
and filters every list query to:

```
ownerId == me  OR  sharedGroupIds intersects (my group ids)
```

Centralizing this means every module inherits the sharing rule for free. At household scale the
intersection is computed in the query. A dedicated `shares` join table is the documented scale-up
path if it is ever needed (intentionally not built now — YAGNI).

### Recipes table

```ts
recipes: defineTable({
  ownerId: v.id('users'),
  sharedGroupIds: v.array(v.id('groups')),
  title: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),     // Convex file storage
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  tags: v.array(v.string()),
  rating: v.optional(v.number()),            // 1–5
  prepMinutes: v.optional(v.number()),
})
  .index('by_owner', ['ownerId'])
```

### Auth wiring

Convex↔Clerk via `convex/auth.config.ts` (Clerk JWT template). Every mutation re-checks, server-side,
that the caller is a member of the group(s) they are reading or writing. The `users` row is
upserted from the Clerk identity on first authenticated request.

---

## 8. Auth integration (`@appelent/auth`)

`@appelent/auth` is the user's shared Clerk-based auth/UI package (in the `appelent-packages`
monorepo, published privately to GitHub Packages at `https://npm.pkg.github.com`). It is already
used by the archstudio and workouts apps.

**Setup**

- Add `.npmrc` pointing `@appelent:registry` to GitHub Packages with a GH token (token via env, not
  committed).
- Add `@appelent/auth` as a dependency (peer deps React 19 + `@clerk/clerk-react` ^5.61 already
  satisfied).

**Replace scaffolded code with the package**

- Remove `src/integrations/clerk/*`, the inline `THEME_INIT_SCRIPT` in `__root.tsx`, and the demo
  `ThemeToggle`.
- Wrap the app in `AuthConfigProvider` with:

  ```ts
  {
    appName: 'gather',
    paths: { signIn: '/sign-in', signUp: '/sign-up', forgotPassword: '/forgot-password',
             afterAuth: '/dashboard', account: '/account' },
    features: { forgotPassword: true },
    socialProviders: [],
  }
  ```

- Use `HeaderUser` in the topbar, `AppearanceSettings` in settings, `ProfilePanel` in account,
  `ThemeSync` + `THEME_INIT_SCRIPT` + `@appelent/auth/tokens.css` for theming, and `TestLoginButton`
  on the sign-in page (only renders on `pk_test_` instances with `VITE_TEST_USER_EMAIL` /
  `VITE_TEST_USER_PASSWORD` set).

---

## 9. Demo cleanup

Removed as part of this work: `src/routes/demo/*`, `src/components/demo-*`, `src/hooks/demo-*`,
`src/data/demo-*`, `src/lib/demo-*`, the guitar/ukelele images in `public/`, and the demo
`products` / `todos` tables in `convex/schema.ts`. The Header's demo dropdown is replaced by the
real sidebar. AI add-on dependencies remain in `package.json` (no demo code).

---

## 10. Error handling, loading, and empty states

- Route-level error boundaries; a shared not-found page.
- Convex `useQuery` returning `undefined` → skeleton loaders for list and detail views.
- Empty states: list views (e.g. no recipes yet) show a friendly empty card with a primary
  "Add" action.
- Mutations validate auth and group membership server-side and surface failures via the route error
  boundary / inline form errors.

---

## 11. Testing (Vitest)

- **Registry integrity:** every registry `path` resolves to a real route; no orphan routes.
- **Sharing filter:** the shared query helper returns owner-private records to the owner only, and
  group-shared records to members of those groups but not to non-members / other groups.
- **Placeholder:** `<ModulePlaceholder>` renders icon, title, and description from a registry entry.
- **Recipe form:** create and edit happy paths (component test), including default `sharedGroupIds`.

---

## 12. Out of scope (future specs)

Every non-Recipes module's real implementation; meal-planner ↔ recipes ↔ groceries linking; finances
modeling; calendar; notifications; recipe import via the AI add-on; multi-household analytics. Each
becomes its own spec when its turn comes.
