# Gather App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build gather's application shell — grouped-sidebar navigation with a ⌘K palette, the per-user/group sharing data model, a reusable placeholder-module pattern, `@appelent/auth` integration — and the first real module, Recipes.

**Architecture:** A pathless authenticated layout route (`_app.tsx`) wraps every module page with a sidebar + topbar and a `beforeLoad` auth guard. A single module registry drives the sidebar, the command palette, and the dashboard. Convex holds users, groups, memberships, and domain records; every record carries `ownerId` + `sharedGroupIds`, and a pure `isVisibleTo` predicate enforces "shared by default, private opt-out" everywhere.

**Tech Stack:** TanStack Start (file router) · Convex · Clerk via `@appelent/auth` · Tailwind v4 · Vitest · Biome · Cloudflare.

**Source spec:** `docs/superpowers/specs/2026-06-21-gather-shell-design.md`

---

## Conventions for this plan

- **Imports:** new app files use **relative imports** to match the existing scaffold style (e.g. `../lib/modules`). Convex files import from `./_generated/*`.
- **Verification commands:**
  - Tests: `npm test` (or a single file: `npx vitest run path/to/file.test.ts`)
  - Types: `npx tsc --noEmit`
  - Lint/format: `npm run check`
  - Build: `npm run build`
  - Convex schema/functions push (dev): `npx convex dev --once`
- **Commits:** one per task (or per logical step where noted). Conventional-commit prefixes.
- Structural tasks (deleting demo code, adding placeholder route files) verify via `tsc`/`build` rather than unit tests — that is the correct verification for those changes. Logic units (sharing predicate, registry integrity, placeholder render, recipe form) use real TDD.

## Manual prerequisites (do before Task 1; not automatable here)

These require the user's accounts and are documented so the engineer knows they are needed:

1. **GitHub Packages token** — `@appelent/auth` is private on GitHub Packages. Export a token with `read:packages` as `NODE_AUTH_TOKEN` in the shell before `npm install` (used by `.npmrc` in Task 1). Do **not** commit the token.
2. **Clerk JWT template** — in the Clerk dashboard, create a JWT template named `convex` (Convex's standard integration). Note the Issuer (Frontend API URL, e.g. `https://<slug>.clerk.accounts.dev`).
3. **Convex env var** — set the Clerk issuer on Convex: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<slug>.clerk.accounts.dev`.
4. **`.env.local`** already holds `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT` (from scaffold). For the dev test-login button, optionally add `VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD`.

---

## File structure (created or modified)

**Created**
- `.npmrc` — GitHub Packages registry for `@appelent`
- `vitest.config.ts` — jsdom test env + setup
- `vitest.setup.ts` — Testing Library matchers
- `convex/auth.config.ts` — Clerk provider for Convex
- `convex/lib/sharing.ts` — `isVisibleTo` predicate + Convex auth helpers
- `convex/lib/sharing.test.ts` — predicate unit tests
- `convex/users.ts`, `convex/groups.ts`, `convex/recipes.ts`
- `src/lib/modules.ts` — module registry; `src/lib/modules.test.ts`
- `src/components/app/ModulePlaceholder.tsx` (+ `.test.tsx`)
- `src/components/app/Sidebar.tsx`, `src/components/app/Topbar.tsx`, `src/components/app/CommandPalette.tsx`
- `src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`
- `src/routes/_app.tsx` and `src/routes/_app/*` (dashboard, recipes, placeholders, settings, groups, account)
- `src/components/recipes/RecipeForm.tsx` (+ `.test.tsx`)

**Modified**
- `package.json` (deps), `vite.config.ts` (none needed; vitest uses its own config), `convex/schema.ts`
- `src/integrations/convex/provider.tsx` (Clerk-aware Convex client)
- `src/integrations/clerk/provider.tsx` (kept; publishable key)
- `src/routes/__root.tsx` (providers, theme), `src/routes/index.tsx` (redirect)
- `src/components/Header.tsx`, `src/components/Footer.tsx` (demo removal)

**Deleted** (demo cleanup — Task 2)
- `src/routes/demo/**`, `src/components/demo-*`, `src/hooks/demo-*`, `src/data/demo-*`, `src/lib/demo-*`, `src/components/ThemeToggle.tsx`, `src/integrations/clerk/header-user.tsx`, `public/example-guitar-*.jpg`, `public/example-ukelele-*.jpg`

---

# Phase 0 — Cleanup & dependencies

### Task 1: Add `@appelent/auth` dependency via GitHub Packages

**Files:**
- Create: `.npmrc`
- Modify: `package.json`

- [ ] **Step 1: Create `.npmrc`**

```
@appelent:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- [ ] **Step 2: Add the dependency**

Run:
```bash
npm install @appelent/auth
```
Expected: installs `@appelent/auth` (peer deps `react@19`, `@clerk/clerk-react@^5.61` already satisfied). `package.json` gains `"@appelent/auth"` under `dependencies`.

- [ ] **Step 3: Verify the package resolves**

Run: `node -e "require.resolve('@appelent/auth/package.json'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add .npmrc package.json package-lock.json
git commit -m "chore: add @appelent/auth via GitHub Packages registry"
```

---

### Task 2: Remove scaffold demo code

**Files:**
- Delete: demo routes/components/hooks/data/lib + guitar images + `ThemeToggle.tsx` + `integrations/clerk/header-user.tsx`
- Modify: `src/routes/__root.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`

- [ ] **Step 1: Delete demo files**

```bash
git rm -r src/routes/demo
git rm src/components/demo-AIAssistant.tsx src/components/demo-GuitarRecommendation.tsx
git rm src/hooks/demo-useAudioRecorder.ts src/hooks/demo-useTTS.ts
git rm src/data/demo-guitars.ts src/data/demo-table-data.ts
git rm src/lib/demo-ai-hook.ts src/lib/demo-guitar-tools.ts src/lib/demo-store.ts src/lib/demo-store-devtools.tsx
git rm src/components/ThemeToggle.tsx src/integrations/clerk/header-user.tsx
git rm public/example-guitar-*.jpg public/example-ukelele-*.jpg
```

- [ ] **Step 2: Strip demo references from `__root.tsx`**

Replace the imports of `StoreDevtools` and its use in the `plugins` array, and remove the `ThemeToggle`/demo `Header` coupling. The full new `__root.tsx` is written in Task 5 — for now, make it compile by removing these two lines:
- delete `import StoreDevtools from '../lib/demo-store-devtools'`
- delete the `StoreDevtools,` entry in the `plugins={[...]}` array.

- [ ] **Step 3: Replace `Header.tsx` with a minimal placeholder header**

The real navigation is the sidebar (Phase 3). Until then, replace `src/components/Header.tsx` entirely so nothing imports deleted demo files:

```tsx
export default function Header() {
  return null
}
```

(`Header` is removed from the tree entirely in Task 5; this keeps the build green in between.)

- [ ] **Step 4: Verify the app still type-checks and builds**

Run: `npx tsc --noEmit`
Expected: PASS (no references to deleted files).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove scaffold demo code (guitars, demo AI, store, table)"
```

---

# Phase 1 — Auth + theme integration

### Task 3: Add Vitest config for component tests

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname, '#': new URL('./src', import.meta.url).pathname },
  },
})
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import '@testing-library/dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Add a smoke test to confirm the runner works**

Create `src/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 5: Remove the smoke test and commit**

```bash
git rm src/smoke.test.ts
git add vitest.config.ts vitest.setup.ts
git commit -m "test: add vitest jsdom config and setup"
```

---

### Task 4: Wire Convex to Clerk auth

**Files:**
- Create: `convex/auth.config.ts`
- Modify: `src/integrations/convex/provider.tsx`

- [ ] **Step 1: Create `convex/auth.config.ts`**

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
}
```

- [ ] **Step 2: Make the Convex provider Clerk-aware**

Replace `src/integrations/convex/provider.tsx` with:
```tsx
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import { useAuth } from '@clerk/clerk-react'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL')
}

const convex = new ConvexReactClient(CONVEX_URL)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
```

- [ ] **Step 3: Push the auth config to Convex and type-check**

Run: `npx convex dev --once`
Expected: Convex picks up `auth.config.ts` without error (requires `CLERK_JWT_ISSUER_DOMAIN` set per prerequisites).
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/auth.config.ts src/integrations/convex/provider.tsx
git commit -m "feat: wire Convex to Clerk auth (ConvexProviderWithClerk)"
```

---

### Task 5: Root providers + theme via `@appelent/auth`

**Files:**
- Modify: `src/routes/__root.tsx`, `src/styles.css`
- Delete: `src/components/Header.tsx`, `src/components/Footer.tsx` (no longer rendered at root)

- [ ] **Step 1: Import the package's theme CSS in `src/styles.css`**

Add at the very top of `src/styles.css` (before existing content):
```css
@import '@appelent/auth/tokens.css';
```

- [ ] **Step 2: Rewrite `src/routes/__root.tsx`**

```tsx
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  AuthConfigProvider,
  ThemeSync,
  THEME_INIT_SCRIPT,
  type AuthConfig,
} from '@appelent/auth'
import ClerkProvider from '../integrations/clerk/provider'
import ConvexProvider from '../integrations/convex/provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const authConfig: AuthConfig = {
  appName: 'gather',
  paths: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    forgotPassword: '/forgot-password',
    afterAuth: '/dashboard',
    account: '/account',
  },
  features: { forgotPassword: true },
  socialProviders: [],
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'gather' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        <ClerkProvider>
          <ConvexProvider>
            <AuthConfigProvider config={authConfig}>
              <ThemeSync />
              {children}
              <TanStackDevtools
                config={{ position: 'bottom-right' }}
                plugins={[
                  {
                    name: 'Tanstack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                  TanStackQueryDevtools,
                ]}
              />
            </AuthConfigProvider>
          </ConvexProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

> Note: if `THEME_INIT_SCRIPT`, `ThemeSync`, or `AuthConfig` are not exported as named imports by the installed version, check `node_modules/@appelent/auth/dist/index.d.ts` and adjust the import — the source exports them (see spec §8).

- [ ] **Step 3: Delete the now-unused Header/Footer**

```bash
git rm src/components/Header.tsx src/components/Footer.tsx
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run build` → succeeds

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: root providers + theme via @appelent/auth"
```

---

### Task 6: Auth routes + landing redirect

**Files:**
- Create: `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Create `src/routes/sign-in.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SignInForm, TestLoginButton } from '@appelent/auth'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <SignInForm />
      <TestLoginButton />
    </main>
  )
}
```

- [ ] **Step 2: Create `src/routes/sign-up.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SignUpForm } from '@appelent/auth'

export const Route = createFileRoute('/sign-up')({ component: SignUpPage })

function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <SignUpForm />
    </main>
  )
}
```

- [ ] **Step 3: Create `src/routes/forgot-password.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@appelent/auth'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <ForgotPasswordForm />
    </main>
  )
}
```

- [ ] **Step 4: Replace `src/routes/index.tsx` with a redirect**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
```

> The `_app` layout guard (Task 13) sends signed-out users from `/dashboard` to `/sign-in`, so unauthenticated visitors to `/` land on sign-in; authenticated visitors land on the dashboard.

- [ ] **Step 5: Generate routes, type-check, commit**

Run: `npm run generate-routes` (updates `routeTree.gen.ts`)
Run: `npx tsc --noEmit` → PASS

```bash
git add -A
git commit -m "feat: sign-in/up, forgot-password routes and landing redirect"
```

---

# Phase 2 — Data model

### Task 7: Convex schema — users, groups, memberships

**Files:**
- Modify: `convex/schema.ts`
- Delete: `convex/todos.ts`

- [ ] **Step 1: Replace `convex/schema.ts`**

```ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    defaultGroupId: v.optional(v.id('groups')),
  }).index('by_clerkId', ['clerkId']),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    type: v.optional(v.string()),
  }).index('by_inviteCode', ['inviteCode']),

  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),
})
```

- [ ] **Step 2: Delete demo `todos.ts`**

```bash
git rm convex/todos.ts
```

- [ ] **Step 3: Push schema and type-check**

Run: `npx convex dev --once`
Expected: schema pushes; old `products`/`todos` tables are dropped (Convex prompts if data exists — confirm; dev deployment has none).
Run: `npx tsc --noEmit` → PASS

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(convex): users, groups, memberships schema"
```

---

### Task 8: Sharing predicate (pure) — TDD

**Files:**
- Create: `convex/lib/sharing.ts`, `convex/lib/sharing.test.ts`

- [ ] **Step 1: Write the failing test `convex/lib/sharing.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { isVisibleTo } from './sharing'

const viewer = { userId: 'u1', groupIds: ['gA', 'gB'] }

describe('isVisibleTo', () => {
  test('owner sees their own private record', () => {
    const rec = { ownerId: 'u1', sharedGroupIds: [] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })

  test('non-owner cannot see a private record', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: [] }
    expect(isVisibleTo(rec, viewer)).toBe(false)
  })

  test('member of a shared group sees the record', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: ['gB'] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })

  test('record shared only with a group the viewer is not in is hidden', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: ['gC'] }
    expect(isVisibleTo(rec, viewer)).toBe(false)
  })

  test('owner always sees their record regardless of groups', () => {
    const rec = { ownerId: 'u1', sharedGroupIds: ['gC'] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/lib/sharing.test.ts`
Expected: FAIL — `isVisibleTo` not defined.

- [ ] **Step 3: Implement `convex/lib/sharing.ts`**

```ts
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export interface Viewer<U = string, G = string> {
  userId: U
  groupIds: G[]
}

export interface ShareableRecord<U = string, G = string> {
  ownerId: U
  sharedGroupIds: G[]
}

export function isVisibleTo<U, G>(
  record: ShareableRecord<U, G>,
  viewer: Viewer<U, G>,
): boolean {
  if (record.ownerId === viewer.userId) return true
  return record.sharedGroupIds.some((g) => viewer.groupIds.includes(g))
}

/** Resolve the calling Clerk user to their gather `users` row, or null. */
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
    .unique()
}

/** Group ids the given user belongs to. */
export async function getMyGroupIds(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Id<'groups'>[]> {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  return memberships.map((m) => m.groupId)
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/lib/sharing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/sharing.ts convex/lib/sharing.test.ts
git commit -m "feat(convex): isVisibleTo sharing predicate + auth helpers"
```

---

### Task 9: Users — upsert from Clerk identity

**Files:**
- Create: `convex/users.ts`

- [ ] **Step 1: Implement `convex/users.ts`**

```ts
import { mutation, query } from './_generated/server'
import { getCurrentUser } from './lib/sharing'

/** Returns the current gather user row, or null if not signed in / not yet provisioned. */
export const me = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
})

/**
 * Idempotently provision the signed-in Clerk user as a gather user.
 * On first call, also creates a personal default group + membership so that
 * "shared by default" has a target.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (existing) {
      const patch: Record<string, string> = {}
      const name = identity.name ?? existing.name
      const email = identity.email ?? existing.email
      if (name !== existing.name) patch.name = name
      if (email !== existing.email) patch.email = email
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) {
        patch.imageUrl = identity.pictureUrl
      }
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch)
      return existing._id
    }

    const userId = await ctx.db.insert('users', {
      clerkId: identity.subject,
      name: identity.name ?? 'Member',
      email: identity.email ?? '',
      imageUrl: identity.pictureUrl ?? undefined,
    })

    const inviteCode = crypto.randomUUID().slice(0, 8)
    const groupId = await ctx.db.insert('groups', {
      name: 'Home',
      inviteCode,
      type: 'home',
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId,
      role: 'owner',
    })
    await ctx.db.patch(userId, { defaultGroupId: groupId })
    return userId
  },
})
```

- [ ] **Step 2: Push and type-check**

Run: `npx convex dev --once` → functions compile
Run: `npx tsc --noEmit` → PASS

- [ ] **Step 3: Commit**

```bash
git add convex/users.ts
git commit -m "feat(convex): ensureUser provisioning + me query"
```

---

### Task 10: Groups — list, join, set default

**Files:**
- Create: `convex/groups.ts`

- [ ] **Step 1: Implement `convex/groups.ts`**

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const ids = await getMyGroupIds(ctx, user._id)
    const groups = await Promise.all(ids.map((id) => ctx.db.get(id)))
    return groups
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .map((g) => ({ ...g, isDefault: g._id === user.defaultGroupId }))
  },
})

export const createGroup = mutation({
  args: { name: v.string(), type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const groupId = await ctx.db.insert('groups', {
      name: args.name,
      type: args.type,
      inviteCode: crypto.randomUUID().slice(0, 8),
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: user._id,
      role: 'owner',
    })
    return groupId
  },
})

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const group = await ctx.db
      .query('groups')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode))
      .unique()
    if (!group) throw new Error('Invalid invite code')

    const already = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('groupId'), group._id))
      .unique()
    if (!already) {
      await ctx.db.insert('memberships', {
        groupId: group._id,
        userId: user._id,
        role: 'member',
      })
    }
    return group._id
  },
})

export const setDefaultGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const member = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .unique()
    if (!member) throw new Error('Not a member of that group')
    await ctx.db.patch(user._id, { defaultGroupId: args.groupId })
  },
})
```

- [ ] **Step 2: Push, type-check, commit**

Run: `npx convex dev --once` → compiles
Run: `npx tsc --noEmit` → PASS

```bash
git add convex/groups.ts
git commit -m "feat(convex): group create/join/list/setDefault"
```

---

# Phase 3 — Navigation shell

### Task 11: Module registry — TDD

**Files:**
- Create: `src/lib/modules.ts`, `src/lib/modules.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/modules.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { MODULES, MODULE_GROUPS, modulesByGroup } from './modules'

describe('module registry', () => {
  test('every module has a unique id and path', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    const paths = new Set(MODULES.map((m) => m.path))
    expect(ids.size).toBe(MODULES.length)
    expect(paths.size).toBe(MODULES.length)
  })

  test('every module path starts with a slash', () => {
    for (const m of MODULES) expect(m.path.startsWith('/')).toBe(true)
  })

  test('every module group is a declared group', () => {
    for (const m of MODULES) expect(MODULE_GROUPS).toContain(m.group)
  })

  test('recipes is the only live module initially', () => {
    const live = MODULES.filter((m) => m.status === 'live').map((m) => m.id)
    expect(live).toEqual(['recipes'])
  })

  test('modulesByGroup buckets every module', () => {
    const total = Object.values(modulesByGroup()).reduce(
      (n, arr) => n + arr.length,
      0,
    )
    expect(total).toBe(MODULES.length)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/lib/modules.test.ts`
Expected: FAIL — module `./modules` not found.

- [ ] **Step 3: Implement `src/lib/modules.ts`**

```ts
export type ModuleStatus = 'live' | 'placeholder'

export const MODULE_GROUPS = [
  'Kitchen',
  'Money',
  'Home & life',
  'Tasting',
] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export interface ModuleDef {
  id: string
  label: string
  icon: string // lucide-react icon name
  group: ModuleGroup
  path: string
  status: ModuleStatus
  description: string
}

export const MODULES: ModuleDef[] = [
  { id: 'recipes', label: 'Recipes', icon: 'ChefHat', group: 'Kitchen', path: '/recipes', status: 'live', description: 'Keep and rate the dishes you cook.' },
  { id: 'meal-planner', label: 'Meal planner', icon: 'CalendarHeart', group: 'Kitchen', path: '/meal-planner', status: 'placeholder', description: 'Plan the week’s meals.' },
  { id: 'groceries', label: 'Groceries', icon: 'ShoppingCart', group: 'Kitchen', path: '/groceries', status: 'placeholder', description: 'A shared shopping list you both check off.' },
  { id: 'pantry', label: 'Pantry', icon: 'Refrigerator', group: 'Kitchen', path: '/pantry', status: 'placeholder', description: 'Track what’s in stock at home.' },
  { id: 'finances', label: 'Finances', icon: 'Wallet', group: 'Money', path: '/finances', status: 'placeholder', description: 'Budgets and spending overview.' },
  { id: 'bills', label: 'Bills & subscriptions', icon: 'Receipt', group: 'Money', path: '/bills', status: 'placeholder', description: 'Recurring bills and subscriptions.' },
  { id: 'tasks', label: 'Tasks', icon: 'ListChecks', group: 'Home & life', path: '/tasks', status: 'placeholder', description: 'Shared to-do lists.' },
  { id: 'calendar', label: 'Calendar', icon: 'Calendar', group: 'Home & life', path: '/calendar', status: 'placeholder', description: 'Household events and reminders.' },
  { id: 'notes', label: 'Notes', icon: 'NotebookPen', group: 'Home & life', path: '/notes', status: 'placeholder', description: 'Quick shared notes.' },
  { id: 'cheeses', label: 'Cheeses', icon: 'Grape', group: 'Tasting', path: '/cheeses', status: 'placeholder', description: 'Rate the cheeses you try.' },
  { id: 'wines', label: 'Wines', icon: 'Wine', group: 'Tasting', path: '/wines', status: 'placeholder', description: 'Rate the wines you try.' },
]

export function modulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const out = Object.fromEntries(
    MODULE_GROUPS.map((g) => [g, [] as ModuleDef[]]),
  ) as Record<ModuleGroup, ModuleDef[]>
  for (const m of MODULES) out[m.group].push(m)
  return out
}
```

> Icon names are `lucide-react` exports (already a dependency). `Grape` stands in for cheeses (lucide has no cheese glyph); swap later if desired.

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/modules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/modules.ts src/lib/modules.test.ts
git commit -m "feat: module registry with integrity tests"
```

---

### Task 12: ModulePlaceholder component — TDD

**Files:**
- Create: `src/components/app/ModulePlaceholder.tsx`, `src/components/app/ModulePlaceholder.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/app/ModulePlaceholder.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ModulePlaceholder } from './ModulePlaceholder'

test('renders the module label and description with a coming-soon note', () => {
  render(
    <ModulePlaceholder
      label="Groceries"
      description="A shared shopping list you both check off."
      icon="ShoppingCart"
    />,
  )
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeDefined()
  expect(
    screen.getByText('A shared shopping list you both check off.'),
  ).toBeDefined()
  expect(screen.getByText(/coming soon/i)).toBeDefined()
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/components/app/ModulePlaceholder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/app/ModulePlaceholder.tsx`**

```tsx
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function ModulePlaceholder({
  label,
  description,
  icon,
}: {
  label: string
  description: string
  icon: string
}) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[icon] ?? Icons.Square

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <Icon className="h-10 w-10 opacity-60" aria-hidden="true" />
      <h1 className="text-xl font-semibold">{label}</h1>
      <p className="text-sm opacity-70">{description}</p>
      <span className="mt-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wide opacity-60">
        Coming soon
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/components/app/ModulePlaceholder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/ModulePlaceholder.tsx src/components/app/ModulePlaceholder.test.tsx
git commit -m "feat: ModulePlaceholder component"
```

---

### Task 13: Authenticated layout `_app.tsx` with guard

**Files:**
- Create: `src/routes/_app.tsx`

- [ ] **Step 1: Implement `src/routes/_app.tsx`**

```tsx
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import { Sidebar } from '../components/app/Sidebar'
import { Topbar } from '../components/app/Topbar'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const navigate = useNavigate()

  // Clerk/Convex auth is resolved on the client, so gate here rather than in
  // beforeLoad. A redirect cannot be thrown from an effect — navigate instead.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/sign-in' })
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (isAuthenticated) void ensureUser({})
  }, [isAuthenticated, ensureUser])

  if (isLoading) {
    return <div className="grid min-h-svh place-items-center text-sm opacity-60">Loading…</div>
  }
  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

> Sidebar/Topbar are created next; this file will not type-check until Task 14–15 land. Implement 13→15 consecutively, then run verification once at the end of Task 15.

- [ ] **Step 2: Commit (after Sidebar/Topbar exist — see Task 15 Step 4)**

(No standalone verification here; committed together in Task 15.)

---

### Task 14: Sidebar

**Files:**
- Create: `src/components/app/Sidebar.tsx`

- [ ] **Step 1: Implement `src/components/app/Sidebar.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODULE_GROUPS, modulesByGroup } from '../../lib/modules'

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <C className={className} aria-hidden="true" />
}

export function Sidebar() {
  const byGroup = modulesByGroup()
  return (
    <aside className="hidden w-60 shrink-0 border-r p-4 sm:block">
      <Link to="/dashboard" className="mb-4 flex items-center gap-2 px-2 font-semibold no-underline">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        gather
      </Link>

      <Link
        to="/dashboard"
        className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm no-underline"
        activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}
      >
        <Icon name="LayoutDashboard" className="h-4 w-4" />
        Dashboard
      </Link>

      {MODULE_GROUPS.map((group) => (
        <div key={group} className="mb-3">
          <p className="px-3 pb-1 text-[11px] uppercase tracking-wide opacity-50">{group}</p>
          {byGroup[group].map((m) => (
            <Link
              key={m.id}
              to={m.path}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90"
              activeProps={{ className: 'bg-black/5 dark:bg-white/10 opacity-100' }}
            >
              <Icon name={m.icon} className="h-4 w-4" />
              {m.label}
            </Link>
          ))}
        </div>
      ))}

      <div className="mt-4 border-t pt-3">
        <Link to="/settings" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90" activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}>
          <Icon name="Settings" className="h-4 w-4" /> Settings
        </Link>
        <Link to="/groups" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90" activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}>
          <Icon name="Users" className="h-4 w-4" /> Groups
        </Link>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2:** (verified in Task 15)

---

### Task 15: Topbar + Command palette

**Files:**
- Create: `src/components/app/Topbar.tsx`, `src/components/app/CommandPalette.tsx`

- [ ] **Step 1: Implement `src/components/app/CommandPalette.tsx`**

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MODULES } from '../../lib/modules'

const ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  ...MODULES.map((m) => ({ label: m.label, path: m.path })),
  { label: 'Settings', path: '/settings' },
  { label: 'Groups', path: '/groups' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null
  const results = ITEMS.filter((i) =>
    i.label.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white p-2 shadow-lg dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to…"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {results.map((i) => (
            <li key={i.path}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  setOpen(false)
                  setQ('')
                  navigate({ to: i.path })
                }}
              >
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/components/app/Topbar.tsx`**

```tsx
import { HeaderUser } from '@appelent/auth'
import { CommandPalette } from './CommandPalette'

export function Topbar() {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-8">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm opacity-70"
        onClick={() => {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
          )
        }}
      >
        <span>Jump to…</span>
        <kbd className="rounded border px-1 text-xs">⌘K</kbd>
      </button>
      <div className="ml-auto">
        <HeaderUser />
      </div>
      <CommandPalette />
    </header>
  )
}
```

- [ ] **Step 3: Generate routes + verify the whole layout compiles**

Run: `npm run generate-routes`
Run: `npx tsc --noEmit` → PASS
Run: `npm run build` → succeeds

- [ ] **Step 4: Commit Tasks 13–15 together**

```bash
git add src/routes/_app.tsx src/components/app/Sidebar.tsx src/components/app/Topbar.tsx src/components/app/CommandPalette.tsx
git commit -m "feat: authed layout with sidebar, topbar, and command palette"
```

---

### Task 16: Placeholder + meta routes

**Files:**
- Create: `src/routes/_app/<module>.tsx` for the 10 placeholder modules, plus `settings.tsx`, `groups.tsx`, `account.tsx`

- [ ] **Step 1: Create one placeholder route per non-live module**

For each module in the registry with `status: 'placeholder'`, create `src/routes/_app/<path>.tsx`. Example — `src/routes/_app/groceries.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'
import { MODULES } from '../../lib/modules'

const def = MODULES.find((m) => m.id === 'groceries')!

export const Route = createFileRoute('/_app/groceries')({
  component: () => (
    <ModulePlaceholder label={def.label} description={def.description} icon={def.icon} />
  ),
})
```

Repeat for: `meal-planner`, `pantry`, `finances`, `bills`, `tasks`, `calendar`, `notes`, `cheeses`, `wines` (change the route path string and the `m.id` to match each).

- [ ] **Step 2: Create `src/routes/_app/settings.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { AppearanceSettings } from '@appelent/auth'

export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <AppearanceSettings />
    </div>
  ),
})
```

- [ ] **Step 3: Create `src/routes/_app/account.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ProfilePanel } from '@appelent/auth'

export const Route = createFileRoute('/_app/account')({
  component: () => (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Account</h1>
      <ProfilePanel />
    </div>
  ),
})
```

- [ ] **Step 4: Create `src/routes/_app/groups.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_app/groups')({ component: GroupsPage })

function GroupsPage() {
  const groups = useQuery(api.groups.myGroups)
  const createGroup = useMutation(api.groups.createGroup)
  const joinByInvite = useMutation(api.groups.joinByInvite)
  const setDefault = useMutation(api.groups.setDefaultGroup)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Groups</h1>

      {groups === undefined ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {groups.map((g) => (
            <li key={g._id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                {g.name}{' '}
                <span className="opacity-50">· invite {g.inviteCode}</span>
                {g.isDefault && <span className="ml-2 rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">default</span>}
              </span>
              {!g.isDefault && (
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void setDefault({ groupId: g._id })}>
                  Make default
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void createGroup({ name: name.trim() }).then(() => setName(''))
          }}
        >
          <p className="mb-2 text-sm font-medium">New group</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wine club" className="mb-2 w-full rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded border px-3 py-1 text-sm">Create</button>
        </form>

        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) void joinByInvite({ inviteCode: code.trim() }).then(() => setCode(''))
          }}
        >
          <p className="mb-2 text-sm font-medium">Join with invite code</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="8-char code" className="mb-2 w-full rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded border px-3 py-1 text-sm">Join</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Generate routes, verify, commit**

Run: `npm run generate-routes`
Run: `npx tsc --noEmit` → PASS
Run: `npm run build` → succeeds

```bash
git add src/routes/_app
git commit -m "feat: placeholder module routes + settings, account, groups"
```

---

### Task 17: Dashboard

**Files:**
- Create: `src/routes/_app/dashboard.tsx`

- [ ] **Step 1: Implement `src/routes/_app/dashboard.tsx`**

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODULES } from '../../lib/modules'

export const Route = createFileRoute('/_app/dashboard')({ component: Dashboard })

function Dashboard() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Welcome to gather</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon =
            (Icons as unknown as Record<string, LucideIcon>)[m.icon] ?? Icons.Square
          return (
            <Link
              key={m.id}
              to={m.path}
              className="flex flex-col gap-2 rounded-xl border p-4 no-underline transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon className="h-6 w-6 opacity-80" aria-hidden="true" />
              <span className="font-medium">{m.label}</span>
              <span className="text-xs opacity-60">{m.description}</span>
              {m.status === 'placeholder' && (
                <span className="mt-1 w-fit rounded-full border px-2 text-[10px] uppercase opacity-50">Soon</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Generate routes, verify, commit**

Run: `npm run generate-routes`
Run: `npx tsc --noEmit` → PASS

```bash
git add src/routes/_app/dashboard.tsx
git commit -m "feat: dashboard with module cards from registry"
```

---

# Phase 4 — Recipes module

### Task 18: Recipes schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the `recipes` table to `convex/schema.ts`**

Inside `defineSchema({ ... })`, add:
```ts
  recipes: defineTable({
    ownerId: v.id('users'),
    sharedGroupIds: v.array(v.id('groups')),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    tags: v.array(v.string()),
    rating: v.optional(v.number()),
    prepMinutes: v.optional(v.number()),
  }).index('by_owner', ['ownerId']),
```

- [ ] **Step 2: Push + type-check**

Run: `npx convex dev --once` → schema updates
Run: `npx tsc --noEmit` → PASS

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(convex): recipes table"
```

---

### Task 19: Recipes Convex functions

**Files:**
- Create: `convex/recipes.ts`

- [ ] **Step 1: Implement `convex/recipes.ts`**

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, getMyGroupIds, isVisibleTo } from './lib/sharing'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const groupIds = await getMyGroupIds(ctx, user._id)
    const all = await ctx.db.query('recipes').collect()
    return all.filter((r) =>
      isVisibleTo(
        { ownerId: r.ownerId, sharedGroupIds: r.sharedGroupIds },
        { userId: user._id, groupIds },
      ),
    )
  },
})

export const get = query({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const recipe = await ctx.db.get(args.id)
    if (!recipe) return null
    const groupIds = await getMyGroupIds(ctx, user._id)
    const visible = isVisibleTo(
      { ownerId: recipe.ownerId, sharedGroupIds: recipe.sharedGroupIds },
      { userId: user._id, groupIds },
    )
    if (!visible) return null
    const imageUrl = recipe.imageId
      ? await ctx.storage.getUrl(recipe.imageId)
      : null
    return { ...recipe, imageUrl }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

const recipeFields = {
  title: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  tags: v.array(v.string()),
  rating: v.optional(v.number()),
  prepMinutes: v.optional(v.number()),
  sharedGroupIds: v.optional(v.array(v.id('groups'))),
}

export const create = mutation({
  args: recipeFields,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { sharedGroupIds, ...rest } = args
    const defaultShare = user.defaultGroupId ? [user.defaultGroupId] : []
    return await ctx.db.insert('recipes', {
      ownerId: user._id,
      sharedGroupIds: sharedGroupIds ?? defaultShare,
      ...rest,
    })
  },
})

export const update = mutation({
  args: { id: v.id('recipes'), ...recipeFields },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    const { id, sharedGroupIds, ...rest } = args
    await ctx.db.patch(id, {
      ...rest,
      ...(sharedGroupIds ? { sharedGroupIds } : {}),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) return
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    await ctx.db.delete(args.id)
  },
})
```

- [ ] **Step 2: Push + type-check**

Run: `npx convex dev --once` → compiles
Run: `npx tsc --noEmit` → PASS

- [ ] **Step 3: Commit**

```bash
git add convex/recipes.ts
git commit -m "feat(convex): recipe list/get/create/update/remove + upload url"
```

---

### Task 20: Recipe list route

**Files:**
- Create: `src/routes/_app/recipes/index.tsx`

- [ ] **Step 1: Implement `src/routes/_app/recipes/index.tsx`**

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'

export const Route = createFileRoute('/_app/recipes/')({ component: RecipeList })

function RecipeList() {
  const recipes = useQuery(api.recipes.list)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <Link to="/recipes/new" className="rounded-md border px-3 py-1.5 text-sm no-underline">
          Add recipe
        </Link>
      </div>

      {recipes === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border bg-black/5" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center">
          <p className="mb-3 text-sm opacity-70">No recipes yet.</p>
          <Link to="/recipes/new" className="rounded-md border px-3 py-1.5 text-sm no-underline">
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {recipes.map((r) => (
            <Link
              key={r._id}
              to="/recipes/$recipeId"
              params={{ recipeId: r._id }}
              className="rounded-xl border p-4 no-underline transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <p className="font-medium">{r.title}</p>
              {r.rating != null && <p className="text-xs opacity-60">{'★'.repeat(r.rating)}</p>}
              {r.tags.length > 0 && (
                <p className="mt-1 text-xs opacity-50">{r.tags.join(', ')}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Generate routes, verify, commit**

Run: `npm run generate-routes`
Run: `npx tsc --noEmit` → PASS

```bash
git add src/routes/_app/recipes/index.tsx
git commit -m "feat: recipe list route with loading + empty states"
```

---

### Task 21: Recipe detail route

**Files:**
- Create: `src/routes/_app/recipes/$recipeId.tsx`

- [ ] **Step 1: Implement `src/routes/_app/recipes/$recipeId.tsx`**

```tsx
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
  component: RecipeDetail,
})

function RecipeDetail() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })
  const remove = useMutation(api.recipes.remove)
  const navigate = useNavigate()

  if (recipe === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null) return <p className="text-sm opacity-60">Recipe not found.</p>

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{recipe.title}</h1>
        <div className="flex gap-2">
          <Link to="/recipes/$recipeId/edit" params={{ recipeId }} className="rounded border px-3 py-1.5 text-sm no-underline">Edit</Link>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={async () => {
              await remove({ id: recipe._id })
              navigate({ to: '/recipes' })
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {recipe.imageUrl && (
        <img src={recipe.imageUrl} alt={recipe.title} className="mb-4 w-full rounded-xl object-cover" />
      )}
      {recipe.description && <p className="mb-4 opacity-80">{recipe.description}</p>}

      <h2 className="mb-2 font-medium">Ingredients</h2>
      <ul className="mb-4 list-disc pl-5 text-sm">
        {recipe.ingredients.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">Steps</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {recipe.steps.map((s, idx) => (
          <li key={idx}>{s}</li>
        ))}
      </ol>
    </article>
  )
}
```

> The edit route `/_app/recipes/$recipeId/edit` is added in Task 22 alongside `new`.

- [ ] **Step 2: Verify (after Task 22 supplies the edit route), commit**

```bash
git add src/routes/_app/recipes/\$recipeId.tsx
git commit -m "feat: recipe detail route"
```

---

### Task 22: Recipe form (create + edit) — TDD on the form component

**Files:**
- Create: `src/components/recipes/RecipeForm.tsx`, `src/components/recipes/RecipeForm.test.tsx`
- Create: `src/routes/_app/recipes/new.tsx`, `src/routes/_app/recipes/$recipeId.edit.tsx`

- [ ] **Step 1: Write the failing test `src/components/recipes/RecipeForm.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RecipeForm } from './RecipeForm'

test('submits title and newline-split ingredients/steps', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.change(screen.getByLabelText('Ingredients'), {
    target: { value: 'pasta\nsalt' },
  })
  fireEvent.change(screen.getByLabelText('Steps'), {
    target: { value: 'boil\nserve' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Pasta',
      ingredients: ['pasta', 'salt'],
      steps: ['boil', 'serve'],
      tags: [],
    }),
  )
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/recipes/RecipeForm.tsx`**

```tsx
import { useState } from 'react'

export interface RecipeFormValues {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating?: number
  prepMinutes?: number
}

interface Props {
  initial?: RecipeFormValues
  submitting: boolean
  onSubmit: (values: RecipeFormValues) => void
}

const lines = (s: string) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean)
const csv = (s: string) =>
  s.split(',').map((l) => l.trim()).filter(Boolean)

export function RecipeForm({ initial, submitting, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState(
    (initial?.ingredients ?? []).join('\n'),
  )
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'))
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '')

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          ingredients: lines(ingredients),
          steps: lines(steps),
          tags: csv(tags),
          rating: rating ? Number(rating) : undefined,
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input className="w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea className="w-full rounded border px-2 py-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Ingredients</span>
        <textarea className="h-28 w-full rounded border px-2 py-1" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="One per line" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Steps</span>
        <textarea className="h-28 w-full rounded border px-2 py-1" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="One per line" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tags</span>
        <input className="w-full rounded border px-2 py-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Rating (1–5)</span>
        <input type="number" min="1" max="5" className="w-24 rounded border px-2 py-1" value={rating} onChange={(e) => setRating(e.target.value)} />
      </label>
      <button type="submit" disabled={submitting} className="rounded-md border px-4 py-2 text-sm">
        {submitting ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `src/routes/_app/recipes/new.tsx`**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/new')({ component: NewRecipe })

function NewRecipe() {
  const create = useMutation(api.recipes.create)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>
      <RecipeForm
        submitting={submitting}
        onSubmit={async (values) => {
          setSubmitting(true)
          const id = await create(values)
          navigate({ to: '/recipes/$recipeId', params: { recipeId: id } })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 6: Implement `src/routes/_app/recipes/$recipeId.edit.tsx`**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipe,
})

function EditRecipe() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })
  const update = useMutation(api.recipes.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  if (recipe === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null) return <p className="text-sm opacity-60">Recipe not found.</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      <RecipeForm
        submitting={submitting}
        initial={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          rating: recipe.rating,
          prepMinutes: recipe.prepMinutes,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          await update({ id: recipe._id, ...values })
          navigate({ to: '/recipes/$recipeId', params: { recipeId } })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 7: Generate routes, full verify, commit**

Run: `npm run generate-routes`
Run: `npm test` → all passing
Run: `npx tsc --noEmit` → PASS
Run: `npm run build` → succeeds

```bash
git add src/components/recipes src/routes/_app/recipes/new.tsx src/routes/_app/recipes/\$recipeId.edit.tsx src/routes/_app/recipes/\$recipeId.tsx
git commit -m "feat: recipe create/edit form and routes"
```

---

### Task 23: Final integration pass

**Files:**
- No new files; whole-app verification.

- [ ] **Step 1: Run the full check suite**

Run: `npm test` → all passing
Run: `npm run check` → no lint/format errors (run `npx biome check --write .` to autofix, then re-run)
Run: `npx tsc --noEmit` → PASS
Run: `npm run build` → succeeds

- [ ] **Step 2: Manual smoke (dev) — documented checklist**

Run: `npm run dev` (and `npx convex dev` in a second terminal). Verify:
- Visiting `/` while signed out redirects to `/sign-in`.
- After sign-in, lands on `/dashboard`; sidebar shows all groups + modules.
- ⌘K opens the palette and navigates.
- Recipes: add a recipe → appears in the list → opens detail → edit → delete.
- A placeholder module (e.g. Groceries) shows the "Coming soon" page.
- Groups page lists your "Home" group as default; creating/joining works.

- [ ] **Step 3: Commit any lint autofixes**

```bash
git add -A
git commit -m "chore: final lint/format pass for shell + recipes"
```

---

## Self-review notes (author)

- **Spec coverage:** §3 shell → Tasks 13–15; §4 registry → Task 11; §5 placeholder → Tasks 12, 16; §6 routing → Tasks 6, 13, 16, 17, 20–22; §7 data model → Tasks 7–10, 18–19; §8 auth integration → Tasks 1, 4, 5, 6, 16; §9 demo cleanup → Task 2; §10 error/loading/empty → Tasks 20, 21 (skeleton + empty states); §11 testing → Tasks 8 (sharing filter), 11 (registry), 12 (placeholder), 22 (recipe form).
- **Type consistency:** `isVisibleTo`, `getCurrentUser`, `getMyGroupIds` defined in Task 8 and reused with identical signatures in Tasks 9, 10, 19. `RecipeFormValues` defined in Task 22 and consumed by both recipe routes. Registry `ModuleDef` fields used consistently across Sidebar/Topbar/Dashboard/placeholders.
- **Known follow-ups (out of scope here):** image upload UI in `RecipeForm` (function `generateUploadUrl` exists; wiring the file input is a small enhancement), multi-group share picker in the form (defaults to the user's default group for now), mobile drawer for the sidebar (currently `hidden sm:block`).
```
