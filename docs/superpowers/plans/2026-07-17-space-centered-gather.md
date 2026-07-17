# Space-Centered Gather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gather's global, module-heavy command center with a calm Space-centered product in which Clerk Organizations own membership, Space admins enable modules and set defaults, members personalize navigation and dashboard widgets, and every operational record belongs to exactly one Space.

**Architecture:** A Space is backed by one Clerk Organization and one Convex `spaces` record. Signed Clerk organization claims are the authorization source; Convex maintains an idempotent membership projection for application reads and portability. A typed module/widget catalog drives Space-scoped routes, module availability, navigation, and ordered dashboard snapshots without coupling the shell to module domain code.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Clerk React and Clerk Backend SDK, Convex, Tailwind CSS, Vitest 4, `convex-test`, Biome, pnpm.

## Global Constraints

- Use **Space** everywhere in user-facing copy; remove **Group** from the finished experience.
- A user must create or join a Space before entering the application. Do not auto-create a personal Home Space.
- Clerk Organizations own organization membership, invitations, active organization, and the only two application roles: `admin` and `member`.
- Signed Clerk organization claims authorize every Space-scoped Convex operation. The Convex membership projection is never the sole authorization source.
- Every operational record belongs to exactly one Space. Global reference data such as nutrition reference data remains global.
- Space admins control enabled modules and shared navigation/dashboard defaults. Members can save personal snapshot overrides and reset them to the current shared defaults.
- Tasks, Notes, and Calendar are defaults for new Spaces. If one is still `comingSoon`, store it as `preEnabled`, keep it out of ordinary UI, and surface it automatically when its catalog availability becomes `live`.
- Coming-soon modules appear only in the admin module catalog and never as ordinary navigation, dashboard, command-palette, or All Modules destinations.
- Disabling a module archives it and retains its data. Permanent module deletion is a separate admin action with explicit confirmation.
- Desktop navigation is Space-specific. Mobile navigation contains at most five destinations: Home, the first three visible pins, and All.
- Every enabled live module remains reachable from `/s/:spaceSlug/modules`, even when it is not pinned.
- Dashboard layouts are ordered widget-instance snapshots using only `compact`, `standard`, and `wide` sizes. Free x/y drag-grid coordinates are outside this plan.
- Public sharing is not implemented. Future public shares must be read-only snapshots that can be duplicated, never cross-Space links.
- The Tasks, Notes, Calendar, and nutrition domain/provider work owned by parallel sessions must be integrated through the contracts in this plan, not reimplemented here.
- This is a development reset. Do not add a production data migration or a dual-read compatibility layer.
- Use pnpm only. Run Biome, typecheck, tests, and production build before completion.
- At execution start, inspect `git status`, recent commits, and merged parallel-session changes. Preserve unrelated user work and use `superpowers:using-git-worktrees` unless already isolated.

---

## Authoritative Contracts

These names and shapes are shared across tasks. Change them only by updating every consumer in this plan in the same commit.

```ts
export type SpaceRole = "admin" | "member";
export type ModuleAvailability = "live" | "comingSoon";
export type SpaceModuleState = "preEnabled" | "enabled" | "archived";
export type WidgetSize = "compact" | "standard" | "wide";

export interface WidgetDefinition {
  id: string;
  moduleId: string;
  label: string;
  allowedSizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
  allowMultiple: boolean;
}

export interface WidgetInstance {
  instanceId: string;
  widgetDefinitionId: string;
  size: WidgetSize;
  config?: unknown;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  pathSegment: string;
  availability: ModuleAvailability;
  defaultForNewSpaces: boolean;
  widgets: readonly WidgetDefinition[];
  defaultWidgetIds: readonly string[];
}

export interface SpaceClaims {
  clerkOrganizationId: string;
  role: SpaceRole;
}
```

Clerk's `convex` JWT template must emit top-level `org_id` and `org_role` claims for the active organization. Accepted roles are `org:admin`/`admin` and `org:member`/`member`; the application normalizes them to `admin` and `member`.

## File Responsibility Map

### Domain and selectors

- `src/lib/modules.ts` — static module definitions and catalog lookup; contains no React or Convex code.
- `src/lib/widgets.ts` — widget definitions, instance validation, effective dashboard selection, and ordered-layout operations.
- `src/lib/spaceModules.ts` — module-state visibility and new-Space default calculations.
- `src/lib/spaceNavigation.ts` — effective pins, mobile dock, desktop navigation, and All Modules ordering.
- `src/lib/spaceRoutes.ts` — typed route builders and reserved path-segment validation.

### Convex boundary

- `convex/lib/spaceAuth.ts` — identity parsing and Space authorization helpers.
- `convex/lib/spaceDefaults.ts` — serializable defaults created from the static catalog.
- `convex/lib/moduleLifecycle.ts` — registry of module-owned permanent data cleanup functions.
- `convex/spaces.ts` — Space provisioning, listing, context, deletion-state transitions.
- `convex/spaceModules.ts` — admin module state and permanent-deletion orchestration.
- `convex/spacePreferences.ts` — personal navigation/dashboard snapshots and reset mutations.
- `convex/clerkSync.ts` — idempotent internal projection mutations.
- `convex/clerkWebhook.ts` — verified Clerk webhook HTTP action and event normalization.
- `convex/spaceAdmin.ts` — Clerk Backend API actions for names, invitations, roles, removal, reconciliation, and Space deletion.
- `convex/users.ts` — current-user projection only; no automatic Space creation.
- `convex/recipes.ts` and `convex/recipeImport.ts` — Recipes domain migrated to one-Space ownership.

### React boundary

- `src/components/spaces/SpaceRouteGate.tsx` — aligns the URL Space with Clerk's active organization before rendering Space data.
- `src/components/spaces/SpaceContext.tsx` — exposes one resolved Space context to the shell and routes.
- `src/components/spaces/SpaceSwitcher.tsx` — lists accessible Spaces and changes URL/active organization.
- `src/components/dashboard/*` — dashboard renderer, isolated widget frames, editor, and library.
- `src/components/shell/*` — calm Space-aware shell and responsive navigation only; no domain data fetching.
- `src/routes/_app/s/$spaceSlug/*` — all Space-owned application routes.

---

### Task 1: Add the Convex Test Harness

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vitest.config.ts`
- Create: `convex/test.setup.ts`
- Create: `convex/test.setup.test.ts`

**Interfaces:**
- Produces: `modules` for `convexTest(schema, modules)` and separate `web`/`convex` Vitest projects.
- Installs: runtime dependency `@clerk/backend`; development dependencies `convex-test` and `@edge-runtime/vm`.

- [ ] **Step 1: Install the dependencies**

Run:

```bash
pnpm add @clerk/backend
pnpm add -D convex-test @edge-runtime/vm
```

Expected: `package.json` and `pnpm-lock.yaml` change; pnpm exits 0.

- [ ] **Step 2: Write a failing Convex smoke test**

```ts
// convex/test.setup.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";

test("loads the Convex schema in the edge-runtime project", async () => {
  const t = convexTest(schema, modules);
  const count = await t.run((ctx) => ctx.db.query("users").collect());
  expect(count).toEqual([]);
});
```

- [ ] **Step 3: Run the test and confirm the missing harness failure**

Run: `pnpm exec vitest run convex/test.setup.test.ts`

Expected: FAIL because `./test.setup` does not exist or because the current jsdom project cannot run Convex.

- [ ] **Step 4: Add the harness and project split**

```ts
// convex/test.setup.ts
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
```

Configure `vitest.config.ts` with these two projects while preserving current aliases/plugins:

```ts
test: {
  projects: [
    { test: { name: "web", environment: "jsdom", exclude: ["convex/**/*.test.ts"] } },
    {
      test: {
        name: "convex",
        environment: "edge-runtime",
        include: ["convex/**/*.test.ts"],
        setupFiles: [],
      },
    },
  ],
},
```

- [ ] **Step 5: Verify both test environments**

Run: `pnpm exec vitest run convex/test.setup.test.ts src/lib/modules.test.ts`

Expected: both the Convex smoke test and existing module tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts convex/test.setup.ts convex/test.setup.test.ts
git commit -m "test: add Convex function test harness"
```

---

### Task 2: Establish the Module, Widget, Navigation, and Route Model

**Files:**
- Replace: `src/lib/modules.ts`
- Create: `src/lib/spaceModules.ts`
- Create: `src/lib/spaceNavigation.ts`
- Create: `src/lib/widgets.ts`
- Create: `src/lib/spaceRoutes.ts`
- Replace: `src/lib/modules.test.ts`
- Create: `src/lib/spaceModules.test.ts`
- Create: `src/lib/spaceNavigation.test.ts`
- Create: `src/lib/widgets.test.ts`
- Create: `src/lib/spaceRoutes.test.ts`

**Interfaces:**
- Produces: the types in **Authoritative Contracts**.
- Produces: `getModuleDefinition`, `getVisibleModuleIds`, `createNewSpaceModuleStates`, `resolvePinnedModuleIds`, `buildMobileDock`, `resolveDashboard`, `validateWidgetInstances`, and `spacePath`.
- Reserved module path segments: `home`, `modules`, `members`, `settings`.

- [ ] **Step 1: Write catalog and coming-soon tests**

```ts
test("pre-enables coming-soon defaults without exposing them", () => {
  expect(createNewSpaceModuleStates(MODULES)).toContainEqual({
    moduleId: "calendar",
    state: "preEnabled",
  });
  expect(getVisibleModuleIds(MODULES, [{ moduleId: "calendar", state: "preEnabled" }])).not.toContain("calendar");
});

test("promotes a pre-enabled module when its catalog entry becomes live", () => {
  const catalog = MODULES.map((item) => item.id === "calendar" ? { ...item, availability: "live" as const } : item);
  expect(getVisibleModuleIds(catalog, [{ moduleId: "calendar", state: "preEnabled" }])).toContain("calendar");
});
```

- [ ] **Step 2: Write snapshot-inheritance and mobile-limit tests**

```ts
test("personal empty pins override rather than inherit defaults", () => {
  expect(resolvePinnedModuleIds(["recipes"], [])).toEqual([]);
  expect(resolvePinnedModuleIds(["recipes"], undefined)).toEqual(["recipes"]);
});

test("mobile shows Home, three visible pins, and All", () => {
  expect(buildMobileDock(["tasks", "notes", "calendar", "recipes"])).toEqual([
    "home", "tasks", "notes", "calendar", "modules",
  ]);
});
```

- [ ] **Step 3: Write widget and route validation tests**

```ts
test("rejects an unavailable widget size", () => {
  expect(() => validateWidgetInstances([
    { instanceId: "one", widgetDefinitionId: "calendar.upcoming", size: "compact" },
  ], WIDGETS)).toThrow("calendar.upcoming does not support compact");
});

test("builds a Space-scoped module path", () => {
  expect(spacePath.module("wine-club", "recipes")).toBe("/s/wine-club/recipes");
});
```

- [ ] **Step 4: Run focused tests and observe failures**

Run: `pnpm exec vitest run src/lib/modules.test.ts src/lib/spaceModules.test.ts src/lib/spaceNavigation.test.ts src/lib/widgets.test.ts src/lib/spaceRoutes.test.ts`

Expected: FAIL on missing exports/files.

- [ ] **Step 5: Implement exact selector semantics**

```ts
export function isModuleVisible(definition: ModuleDefinition, state: SpaceModuleState | undefined) {
  return definition.availability === "live" && (state === "enabled" || state === "preEnabled");
}

export function createNewSpaceModuleStates(catalog: readonly ModuleDefinition[]) {
  return catalog.filter((module) => module.defaultForNewSpaces).map((module) => ({
    moduleId: module.id,
    state: module.availability === "live" ? "enabled" as const : "preEnabled" as const,
  }));
}

export function resolvePinnedModuleIds(shared: readonly string[], personal?: readonly string[]) {
  return [...(personal === undefined ? shared : personal)];
}

export function buildMobileDock(pins: readonly string[]) {
  return ["home", ...pins.slice(0, 3), "modules"] as const;
}

export function resolveDashboard(shared: readonly WidgetInstance[], personal?: readonly WidgetInstance[]) {
  return structuredClone(personal === undefined ? shared : personal);
}
```

Define Tasks, Notes, and Calendar as `defaultForNewSpaces: true`. Preserve Recipes as `live` and non-default. Mark unfinished modules `comingSoon`. If the parallel Tasks/Notes/Calendar work already defines module-owned widget IDs, adopt those IDs; otherwise use `tasks.today`, `notes.recent`, and `calendar.upcoming` and make the owning modules register renderers under those IDs.

- [ ] **Step 6: Verify selectors and typecheck**

Run: `pnpm exec vitest run src/lib/modules.test.ts src/lib/spaceModules.test.ts src/lib/spaceNavigation.test.ts src/lib/widgets.test.ts src/lib/spaceRoutes.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS after updating current catalog consumers to use `availability` rather than `status` without yet changing their layout.

- [ ] **Step 7: Commit**

```bash
git add src/lib/modules.ts src/lib/modules.test.ts src/lib/spaceModules.ts src/lib/spaceModules.test.ts src/lib/spaceNavigation.ts src/lib/spaceNavigation.test.ts src/lib/widgets.ts src/lib/widgets.test.ts src/lib/spaceRoutes.ts src/lib/spaceRoutes.test.ts
git commit -m "feat: define Space module and widget contracts"
```

---

### Task 3: Add the Space Schema and Authorization Boundary

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/lib/spaceAuth.ts`
- Create: `convex/lib/spaceDefaults.ts`
- Create: `convex/lib/spaceAuth.test.ts`
- Modify: `convex/users.ts`
- Create: `docs/setup/clerk-spaces.md`

**Interfaces:**
- Produces: `requireUser(ctx)`, `readSpaceClaims(identity)`, `requireActiveSpace(ctx, { spaceSlug, requireAdmin? })`.
- Produces additive tables `spaces`, `spaceMemberships`, `spaceModules`, and `spacePreferences` while legacy Group tables remain temporarily until Task 9's atomic development reset.
- Consumes identity claims `org_id: string` and `org_role: string`.

- [ ] **Step 1: Write authorization tests**

```ts
test("rejects a URL Space that is not the signed active organization", async () => {
  const t = convexTest(schema, modules);
  await seedSpace(t, { slug: "wine", clerkOrganizationId: "org_wine" });
  const member = t.withIdentity({ subject: "user_a", org_id: "org_home", org_role: "org:member" });
  await expect(member.query(api.spaces.context, { spaceSlug: "wine" })).rejects.toThrow("Active organization does not match Space");
});

test("requires the admin role for admin operations", () => {
  expect(() => readSpaceClaims({ org_id: "org_a", org_role: "org:member" } as never, true)).toThrow("Space admin required");
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm exec vitest run convex/lib/spaceAuth.test.ts`

Expected: FAIL because Space auth/schema do not exist.

- [ ] **Step 3: Add validators and additive Space tables**

Use reusable validators in `convex/schema.ts`:

```ts
const widgetInstance = v.object({
  instanceId: v.string(),
  widgetDefinitionId: v.string(),
  size: v.union(v.literal("compact"), v.literal("standard"), v.literal("wide")),
  config: v.optional(v.any()),
});
```

Add:

```ts
spaces: defineTable({
  clerkOrganizationId: v.string(), slug: v.string(), name: v.string(),
  status: v.union(v.literal("active"), v.literal("deleting")),
  defaultPinnedModuleIds: v.array(v.string()), defaultDashboard: v.array(widgetInstance),
  createdAt: v.number(), updatedAt: v.number(),
}).index("by_clerk_organization", ["clerkOrganizationId"]).index("by_slug", ["slug"]),
spaceMemberships: defineTable({
  spaceId: v.id("spaces"), userId: v.id("users"), clerkMembershipId: v.optional(v.string()),
  clerkUserId: v.string(), role: v.union(v.literal("admin"), v.literal("member")),
  createdAt: v.number(), updatedAt: v.number(),
}).index("by_space", ["spaceId"]).index("by_user", ["userId"])
  .index("by_clerk_membership", ["clerkMembershipId"]).index("by_clerk_user", ["clerkUserId"])
  .index("by_space_user", ["spaceId", "userId"]),
spaceModules: defineTable({
  spaceId: v.id("spaces"), moduleId: v.string(),
  state: v.union(v.literal("preEnabled"), v.literal("enabled"), v.literal("archived")),
  deletionStatus: v.optional(v.union(v.literal("pending"), v.literal("failed"))),
  createdAt: v.number(), updatedAt: v.number(),
}).index("by_space", ["spaceId"]).index("by_space_module", ["spaceId", "moduleId"]),
spacePreferences: defineTable({
  spaceId: v.id("spaces"), userId: v.id("users"), pinnedModuleIds: v.optional(v.array(v.string())),
  dashboard: v.optional(v.array(widgetInstance)), updatedAt: v.number(),
}).index("by_user", ["userId"]).index("by_space_user", ["spaceId", "userId"]),
```

- [ ] **Step 4: Implement signed-claim authorization**

`readSpaceClaims` must reject missing/unknown claims, normalize both Clerk role formats, and optionally require admin. `requireActiveSpace` must resolve `spaceSlug`, compare `space.clerkOrganizationId` with `org_id`, reject `deleting`, and return `{ user, space, role }`.

```ts
export async function requireActiveSpace(
  ctx: QueryCtx | MutationCtx,
  args: { spaceSlug: string; requireAdmin?: boolean },
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required");
  const claims = readSpaceClaims(identity, args.requireAdmin);
  const space = await ctx.db.query("spaces").withIndex("by_slug", (q) => q.eq("slug", args.spaceSlug)).unique();
  if (!space) throw new ConvexError("Space not found");
  if (space.clerkOrganizationId !== claims.clerkOrganizationId) throw new ConvexError("Active organization does not match Space");
  if (space.status !== "active") throw new ConvexError("Space is being deleted");
  const user = await requireUser(ctx);
  return { user, space, role: claims.role };
}
```

Remove `defaultGroupId` creation/update behavior from `users.ensure`, but keep the old optional schema field until Task 9.

- [ ] **Step 5: Document exact Clerk configuration and token acceptance**

In `docs/setup/clerk-spaces.md`, record:

1. Enable Organizations and personal accounts in Clerk.
2. Keep only Organization roles Admin (`org:admin`) and Member (`org:member`).
3. Add `org_id: {{org.id}}` and `org_role: {{org.role}}` to the `convex` JWT template.
4. Configure the webhook URL from Task 5 and save its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in the Convex deployment.
5. Save `CLERK_SECRET_KEY` in the Convex deployment for Backend API actions.
6. Acceptance check: sign in, activate an organization, request the `convex` token, decode its payload locally, and confirm its `org_id` and `org_role` match the active organization before continuing.

- [ ] **Step 6: Generate Convex types and verify**

Run: `pnpm exec convex dev --once`

Expected: schema and functions deploy successfully; generated API/types update.

Run: `pnpm exec vitest run convex/lib/spaceAuth.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/lib/spaceAuth.ts convex/lib/spaceAuth.test.ts convex/lib/spaceDefaults.ts convex/users.ts convex/_generated docs/setup/clerk-spaces.md
git commit -m "feat: add Space schema and authorization"
```

---

### Task 4: Provision Spaces and Resolve Space Context

**Files:**
- Create: `convex/spaces.ts`
- Create: `convex/spaces.test.ts`
- Modify: `convex/lib/spaceDefaults.ts`

**Interfaces:**
- Produces: `spaces.mine()`, `spaces.ensureActive({ name })`, `spaces.context({ spaceSlug })`.
- Produces internal mutations `spaces.markDeleting`, `spaces.finalizeDeleted`, and internal query `spaces.resolveActionContext`.
- `ensureActive` is idempotent by signed `org_id`; it creates default `spaceModules` rows only on first creation.

- [ ] **Step 1: Write provisioning and inheritance tests**

```ts
test("provisions one Space per Clerk organization and initializes module defaults once", async () => {
  const member = t.withIdentity({ subject: "user_a", org_id: "org_a", org_role: "org:admin", name: "A" });
  const first = await member.mutation(api.spaces.ensureActive, { name: "Wine Club" });
  const second = await member.mutation(api.spaces.ensureActive, { name: "Renamed in Clerk" });
  expect(second.spaceId).toEqual(first.spaceId);
  expect(await moduleRows(t, first.spaceId)).toHaveLength(3);
});

test("context distinguishes undefined overrides from intentional empty snapshots", async () => {
  const inherited = await member.query(api.spaces.context, { spaceSlug: "wine-club" });
  expect(inherited.navigation.source).toBe("space");
  await saveEmptyOverrides(t, inherited.space._id, inherited.user._id);
  expect((await member.query(api.spaces.context, { spaceSlug: "wine-club" })).navigation).toMatchObject({ source: "personal", pinnedModuleIds: [] });
});
```

- [ ] **Step 2: Run tests and confirm missing API failures**

Run: `pnpm exec vitest run convex/spaces.test.ts`

Expected: FAIL because `convex/spaces.ts` does not exist.

- [ ] **Step 3: Implement deterministic slug allocation and idempotent provisioning**

Use NFKD normalization, remove combining marks, lowercase, replace non-alphanumeric runs with `-`, trim hyphens, and fall back to `space`. If the slug exists for another organization, try `-2`, `-3`, and upward in the same mutation.

```ts
export const ensureActive = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    const claims = readSpaceClaims(identity, true);
    const existing = await ctx.db.query("spaces").withIndex("by_clerk_organization", (q) => q.eq("clerkOrganizationId", claims.clerkOrganizationId)).unique();
    if (existing) return { spaceId: existing._id, slug: existing.slug };
    const user = await requireUser(ctx);
    const now = Date.now();
    const slug = await allocateSpaceSlug(ctx, name);
    const spaceId = await ctx.db.insert("spaces", { clerkOrganizationId: claims.clerkOrganizationId, slug, name, status: "active", defaultPinnedModuleIds: [], defaultDashboard: [], createdAt: now, updatedAt: now });
    await upsertMembershipProjection(ctx, { spaceId, userId: user._id, clerkUserId: identity.subject, role: "admin", now });
    await insertNewSpaceModuleDefaults(ctx, spaceId, now);
    return { spaceId, slug };
  },
});
```

`spaces.context` must return the authorized Space, user, role, catalog-backed module states, effective pins/dashboard plus source (`space` or `personal`), and raw snapshots for editors.

- [ ] **Step 4: Verify focused tests**

Run: `pnpm exec vitest run convex/spaces.test.ts convex/lib/spaceAuth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/spaces.ts convex/spaces.test.ts convex/lib/spaceDefaults.ts convex/_generated
git commit -m "feat: provision and resolve Spaces"
```

---

### Task 5: Synchronize Clerk Organizations into Convex

**Files:**
- Create: `convex/http.ts`
- Create: `convex/clerkWebhook.ts`
- Create: `convex/clerkSync.ts`
- Create: `convex/lib/clerkEvents.ts`
- Create: `convex/clerkSync.test.ts`
- Create: `convex/clerkWebhook.test.ts`
- Modify: `docs/setup/clerk-spaces.md`

**Interfaces:**
- HTTP endpoint: `POST /clerk-webhook`.
- Consumes Clerk events: `user.created|updated`, `organization.created|updated|deleted`, and `organizationMembership.created|updated|deleted`.
- Produces idempotent internal mutations keyed by Clerk IDs; duplicate delivery must not duplicate rows.

- [ ] **Step 1: Write idempotency and deletion tests**

```ts
test("replaying a membership event leaves one projection row", async () => {
  const event = membershipCreatedEvent({ membershipId: "mem_1", organizationId: "org_1", userId: "user_1", role: "org:member" });
  await applyClerkEvent(t, event);
  await applyClerkEvent(t, event);
  expect(await t.run((ctx) => ctx.db.query("spaceMemberships").collect())).toHaveLength(1);
});

test("a deleted organization finalizes a Space already marked deleting", async () => {
  await applyClerkEvent(t, organizationDeletedEvent("org_1"));
  expect(await findSpaceByOrganization(t, "org_1")).toBeNull();
});
```

- [ ] **Step 2: Write the invalid-signature HTTP test**

```ts
test("rejects an unverified Clerk webhook", async () => {
  const response = await t.fetch("/clerk-webhook", { method: "POST", body: "{}" });
  expect(response.status).toBe(400);
});
```

- [ ] **Step 3: Run focused tests and observe failure**

Run: `pnpm exec vitest run convex/clerkSync.test.ts convex/clerkWebhook.test.ts`

Expected: FAIL because webhook and sync functions do not exist.

- [ ] **Step 4: Implement event normalization and idempotent projections**

`convex/lib/clerkEvents.ts` must convert Clerk payloads into this closed union before scheduling internal mutations:

```ts
export type ClerkProjectionEvent =
  | { kind: "user.upsert"; clerkUserId: string; name: string; email: string; imageUrl?: string }
  | { kind: "space.upsert"; clerkOrganizationId: string; name: string }
  | { kind: "space.delete"; clerkOrganizationId: string }
  | { kind: "membership.upsert"; clerkMembershipId: string; clerkOrganizationId: string; clerkUserId: string; role: SpaceRole }
  | { kind: "membership.delete"; clerkMembershipId: string };
```

Membership upserts must resolve both the Space and user by Clerk ID. If either has not arrived yet, upsert the available user data from the membership payload, ensure the Space from organization data, then upsert membership. Deletion events for missing rows return successfully.

- [ ] **Step 5: Verify the webhook before parsing or scheduling**

```ts
// convex/clerkWebhook.ts
"use node";
export const clerkWebhook = httpAction(async (ctx, request) => {
  try {
    const event = await verifyWebhook(request, { signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET });
    const normalized = normalizeClerkEvent(event);
    if (normalized) await ctx.runMutation(internal.clerkSync.apply, normalized);
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("invalid webhook", { status: 400 });
  }
});
```

Register only `http.route({ path: "/clerk-webhook", method: "POST", handler: clerkWebhook })` in `convex/http.ts`.

- [ ] **Step 6: Verify automated and live-delivery paths**

Run: `pnpm exec vitest run convex/clerkSync.test.ts convex/clerkWebhook.test.ts`

Expected: PASS.

After deploying, send one Clerk test event. Expected: Clerk reports HTTP 200 and replaying it changes no row counts. Record the tested URL and event types in `docs/setup/clerk-spaces.md` without recording secrets.

- [ ] **Step 7: Commit**

```bash
git add convex/http.ts convex/clerkWebhook.ts convex/clerkSync.ts convex/lib/clerkEvents.ts convex/clerkSync.test.ts convex/clerkWebhook.test.ts docs/setup/clerk-spaces.md convex/_generated
git commit -m "feat: sync Clerk organizations into Spaces"
```

---

### Task 6: Add Space Administration and Lifecycle Actions

**Files:**
- Create: `convex/spaceAdmin.ts`
- Create: `convex/lib/spaceAdministration.ts`
- Create: `convex/spaceAdmin.test.ts`
- Modify: `convex/spaces.ts`

**Interfaces:**
- Produces actions `rename`, `invite`, `revokeInvitation`, `changeRole`, `removeMember`, `reconcile`, and `deleteSpace`.
- Every public action accepts `spaceSlug`; member-targeting actions additionally accept a Clerk membership or invitation ID, never a Convex user ID supplied by the browser.
- Consumes `internal.spaces.resolveActionContext({ spaceSlug, expectedClerkOrganizationId, requireAdmin: true })` so actions re-check signed identity inside Convex.

- [ ] **Step 1: Write last-admin and reconciliation tests**

```ts
test("cannot demote or remove the final admin", () => {
  expect(() => assertAdminCanLeave([{ id: "mem_admin", role: "admin" }], "mem_admin")).toThrow("A Space must have at least one admin");
});

test("reconciliation replaces stale projection rows", async () => {
  await reconcileMembershipProjection(t, spaceId, [
    { clerkMembershipId: "mem_current", clerkUserId: "user_current", role: "member" },
  ]);
  expect(await projectedMembershipIds(t, spaceId)).toEqual(["mem_current"]);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm exec vitest run convex/spaceAdmin.test.ts`

Expected: FAIL on missing administration helpers/actions.

- [ ] **Step 3: Implement the Backend API action pattern**

Each action must:

1. read the signed identity and its `org_id`/`org_role`;
2. call `resolveActionContext` with the expected organization ID;
3. invoke Clerk with `CLERK_SECRET_KEY`;
4. call an internal projection mutation immediately rather than waiting for the webhook;
5. remain idempotent when the webhook arrives afterward.

```ts
export const changeRole = action({
  args: { spaceSlug: v.string(), clerkMembershipId: v.string(), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, args) => {
    const claims = await requireActionSpaceClaims(ctx, true);
    await ctx.runQuery(internal.spaces.resolveActionContext, { spaceSlug: args.spaceSlug, expectedClerkOrganizationId: claims.clerkOrganizationId, requireAdmin: true });
    const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
    const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: claims.clerkOrganizationId });
    if (args.role === "member") assertAdminCanLeave(normalizeMemberships(memberships.data), args.clerkMembershipId);
    const updated = await clerk.organizations.updateOrganizationMembership({ organizationId: claims.clerkOrganizationId, userId: membershipUserId(memberships.data, args.clerkMembershipId), role: clerkRole(args.role) });
    await ctx.runMutation(internal.clerkSync.applyMembership, normalizeMembership(updated));
  },
});
```

- [ ] **Step 4: Implement resumable Space deletion**

`deleteSpace` must mark the Space `deleting`, invoke every registered module cleanup, delete preferences/modules/membership projections, delete the Clerk organization, and finalize the Space record. A retry must continue safely from `deleting`; an organization-deleted webhook must also finalize the Convex side. Do not accept a deletion request from a member.

- [ ] **Step 5: Verify tests**

Run: `pnpm exec vitest run convex/spaceAdmin.test.ts convex/clerkSync.test.ts`

Expected: PASS for final-admin protection, idempotent projection, reconciliation, and resumable deletion-state tests.

- [ ] **Step 6: Commit**

```bash
git add convex/spaceAdmin.ts convex/lib/spaceAdministration.ts convex/spaceAdmin.test.ts convex/spaces.ts convex/_generated
git commit -m "feat: add Space membership administration"
```

---

### Task 7: Persist Module State and Personal Snapshots

**Files:**
- Create: `convex/spaceModules.ts`
- Create: `convex/spaceModules.test.ts`
- Create: `convex/spacePreferences.ts`
- Create: `convex/spacePreferences.test.ts`
- Create: `convex/lib/moduleLifecycle.ts`

**Interfaces:**
- Produces mutations `spaceModules.setState({ spaceSlug, moduleId, state })` and action `spaceModules.deleteData({ spaceSlug, moduleId, confirmation })`.
- Produces `saveNavigation`, `resetNavigation`, `saveDashboard`, and `resetDashboard` mutations.
- Cleanup registry signature: `(ctx: MutationCtx, spaceId: Id<"spaces">) => Promise<void>`.

- [ ] **Step 1: Write module-state authorization and retention tests**

```ts
test("a member cannot archive a module", async () => {
  await expect(member.mutation(api.spaceModules.setState, { spaceSlug: "wine", moduleId: "recipes", state: "archived" })).rejects.toThrow("Space admin required");
});

test("archiving changes state without deleting domain records", async () => {
  await admin.mutation(api.spaceModules.setState, { spaceSlug: "wine", moduleId: "recipes", state: "archived" });
  expect(await recipeCount(t, spaceId)).toBe(1);
});
```

- [ ] **Step 2: Write personal snapshot and reset tests**

```ts
test("reset deletes only the selected override", async () => {
  await member.mutation(api.spacePreferences.resetNavigation, { spaceSlug: "wine" });
  const row = await preference(t, spaceId, userId);
  expect(row?.pinnedModuleIds).toBeUndefined();
  expect(row?.dashboard).toEqual(savedDashboard);
});
```

- [ ] **Step 3: Run tests and confirm missing-function failures**

Run: `pnpm exec vitest run convex/spaceModules.test.ts convex/spacePreferences.test.ts`

Expected: FAIL.

- [ ] **Step 4: Implement strict catalog validation**

`setState` must reject unknown modules, reject `enabled` for `comingSoon`, allow `preEnabled` only for a catalog default, and require admin. Snapshot saves must remove unknown, archived, or coming-soon module IDs; validate widget definition IDs, sizes, multiplicity, and current module visibility; preserve order; and store `[]` as an intentional empty personal snapshot.

```ts
export const resetNavigation = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, space } = await requireActiveSpace(ctx, args);
    const row = await findPreference(ctx, space._id, user._id);
    if (!row) return;
    if (row.dashboard === undefined) await ctx.db.delete(row._id);
    else await ctx.db.patch(row._id, { pinnedModuleIds: undefined, updatedAt: Date.now() });
  },
});
```

Permanent deletion must set `deletionStatus: "pending"`, run the registered module cleanup, then keep the module archived and clear the marker. On failure set `failed`, retain the archived state, and allow retry. Require exact confirmation text `DELETE <MODULE LABEL>`.

- [ ] **Step 5: Verify tests and generated types**

Run: `pnpm exec vitest run convex/spaceModules.test.ts convex/spacePreferences.test.ts`

Expected: PASS.

Run: `pnpm exec convex dev --once`

Expected: functions deploy and types generate.

- [ ] **Step 6: Commit**

```bash
git add convex/spaceModules.ts convex/spaceModules.test.ts convex/spacePreferences.ts convex/spacePreferences.test.ts convex/lib/moduleLifecycle.ts convex/_generated
git commit -m "feat: persist Space modules and preferences"
```

---

### Task 8: Add Onboarding and the Active-Space Route Boundary

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/_app.tsx`
- Modify: `src/routes/index.tsx`
- Create: `src/routes/_app/onboarding.tsx`
- Create: `src/routes/_app/s/$spaceSlug.tsx`
- Create: `src/routes/_app/s/$spaceSlug/index.tsx`
- Create: `src/routes/_app/s/$spaceSlug/home.tsx`
- Create: `src/routes/_app/s/$spaceSlug/modules.tsx`
- Create: `src/routes/_app/s/$spaceSlug/members.tsx`
- Create: `src/routes/_app/s/$spaceSlug/settings.tsx`
- Create: `src/routes/_app/s/$spaceSlug/settings/index.tsx`
- Create: `src/routes/_app/s/$spaceSlug/settings/modules.tsx`
- Create: `src/routes/_app/s/$spaceSlug/settings/navigation.tsx`
- Create: `src/routes/_app/s/$spaceSlug/settings/dashboard.tsx`
- Create: `src/components/spaces/SpaceRouteGate.tsx`
- Create: `src/components/spaces/SpaceRouteGate.test.tsx`
- Create: `src/components/spaces/SpaceContext.tsx`
- Create: `src/components/spaces/SpaceOnboarding.tsx`
- Create: `src/components/spaces/SpaceOnboarding.test.tsx`

**Interfaces:**
- `SpaceRouteGate` consumes URL `spaceSlug`, Clerk `setActive`, `spaces.mine`, and `spaces.context`.
- `useSpace()` produces `{ space, user, role, modules, navigation, dashboard }` only after Clerk and URL agree.
- Onboarding uses Clerk `useOrganizationList({ userMemberships: true, userInvitations: true })`.

- [ ] **Step 1: Write active-organization gate tests**

```tsx
it("activates the URL organization before rendering children", async () => {
  renderGate({ urlSlug: "wine", activeOrganizationId: "org_home", spaces: [{ slug: "wine", clerkOrganizationId: "org_wine" }] });
  expect(setActive).toHaveBeenCalledWith({ organization: "org_wine" });
  expect(screen.queryByText("Space child")).not.toBeInTheDocument();
  rerenderWithActiveOrganization("org_wine");
  expect(await screen.findByText("Space child")).toBeInTheDocument();
});
```

- [ ] **Step 2: Write onboarding create-or-join tests**

```tsx
it("creates, activates, provisions, and navigates to a Space", async () => {
  await user.type(screen.getByLabelText("Space name"), "Wine Club");
  await user.click(screen.getByRole("button", { name: "Create Space" }));
  expect(createOrganization).toHaveBeenCalledWith({ name: "Wine Club" });
  expect(setActive).toHaveBeenCalledWith({ organization: "org_wine" });
  expect(ensureActive).toHaveBeenCalledWith({ name: "Wine Club" });
  expect(navigate).toHaveBeenCalledWith({ to: "/s/$spaceSlug/home", params: { spaceSlug: "wine-club" } });
});
```

- [ ] **Step 3: Run focused tests and observe failure**

Run: `pnpm exec vitest run src/components/spaces/SpaceRouteGate.test.tsx src/components/spaces/SpaceOnboarding.test.tsx`

Expected: FAIL because components/routes do not exist.

- [ ] **Step 4: Implement onboarding sequencing**

Create flow: `createOrganization({ name })` → `setActive({ organization: organization.id })` → wait for Clerk `organization.id` → `spaces.ensureActive({ name })` → navigate to returned slug. Join flow: `invitation.accept()` → `setActive` using its organization → `ensureActive` → navigate. Disable submit buttons while any step runs and render a retryable inline error retaining the entered name.

If the signed-in user has memberships but no active organization, activate the first membership and navigate. If there are no memberships and no pending invitations, show create. Pending invitations are listed with inviter/Space name and Join buttons.

- [ ] **Step 5: Implement the URL/Clerk/Convex gate**

The gate states are: loading memberships, unknown slug (404), activating Clerk organization, waiting for refreshed Convex token, loading context, and ready. Never issue Space-owned domain queries before ready. `SpaceContext` must throw a clear developer error when used outside the gate.

Move `AppShell` out of `_app.tsx` and into `$spaceSlug.tsx`; `_app.tsx` remains the signed-in boundary. Set Clerk after-sign-in and root redirects to onboarding, which selects/creates a Space.

- [ ] **Step 6: Generate the route tree and verify**

Run: `pnpm run generate-routes`

Expected: `src/routeTree.gen.ts` contains `/onboarding` and `/s/$spaceSlug/*` routes.

Run: `pnpm exec vitest run src/components/spaces/SpaceRouteGate.test.tsx src/components/spaces/SpaceOnboarding.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes src/components/spaces src/routeTree.gen.ts
git commit -m "feat: add Space onboarding and route boundary"
```

---

### Task 9: Migrate Recipes and Remove the Legacy Group Data Model

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`
- Delete: `convex/groups.ts`
- Delete: `convex/lib/sharing.ts`
- Modify: `convex/recipes.ts`
- Modify: `convex/recipes.test.ts`
- Modify: `convex/recipeImport.ts`
- Modify: `convex/recipeImport.test.ts`
- Move: `src/routes/_app/modules/recipes/*` to `src/routes/_app/s/$spaceSlug/recipes/*`
- Modify: every Recipes component/link that builds a recipe URL or invokes a Recipes function

**Interfaces:**
- Recipes functions accept `spaceSlug` and call `requireActiveSpace`.
- Every `recipes` row stores `spaceId` and `createdByUserId`; remove `ownerId` and `sharedGroupIds`.
- All Space members may create, edit, and delete Space recipes; `createdByUserId` is attribution, not authorization.

- [ ] **Step 1: Rewrite Recipes authorization tests first**

```ts
test("a member can update a recipe in the signed active Space", async () => {
  const recipeId = await seedRecipe(t, { spaceId, createdByUserId: otherUserId });
  await member.mutation(api.recipes.update, { spaceSlug: "wine", id: recipeId, name: "Shared edit" });
  expect((await getRecipe(t, recipeId))?.name).toBe("Shared edit");
});

test("cannot read a recipe through another Space slug", async () => {
  await expect(member.query(api.recipes.get, { spaceSlug: "home", id: wineRecipeId })).rejects.toThrow("Active organization does not match Space");
});

test("import requires the Recipes module to be visible", async () => {
  await archiveRecipes(t, spaceId);
  await expect(member.action(api.recipeImport.importFromUrl, { spaceSlug: "wine", url: "https://example.com/recipe" })).rejects.toThrow("Recipes is not enabled");
});
```

- [ ] **Step 2: Run focused tests and confirm old-model failures**

Run: `pnpm exec vitest run convex/recipes.test.ts convex/recipeImport.test.ts`

Expected: FAIL because current APIs use owner/group sharing and lack `spaceSlug`.

- [ ] **Step 3: Perform the atomic development schema reset in code**

Remove `groups`, legacy `memberships`, `users.defaultGroupId`, `recipes.ownerId`, and `recipes.sharedGroupIds`. Define Recipes as:

```ts
recipes: defineTable({
  spaceId: v.id("spaces"), createdByUserId: v.id("users"),
  name: v.string(), description: v.optional(v.string()), imageId: v.optional(v.id("_storage")),
  sourceUrl: v.optional(v.string()), ingredients: v.array(ingredient), instructions: v.array(v.string()),
  servings: v.optional(v.number()), prepTimeMinutes: v.optional(v.number()), cookTimeMinutes: v.optional(v.number()),
  createdAt: v.number(), updatedAt: v.number(),
}).index("by_space", ["spaceId"]),
```

Preserve every additional recipe field introduced by the ratings/import spec or parallel work; only replace ownership/sharing fields.

- [ ] **Step 4: Update every Recipes API and route atomically**

Use signatures:

```ts
list({ spaceSlug: v.string() })
get({ spaceSlug: v.string(), id: v.id("recipes") })
create({ spaceSlug: v.string(), ...recipeInput })
update({ spaceSlug: v.string(), id: v.id("recipes"), ...recipePatch })
remove({ spaceSlug: v.string(), id: v.id("recipes") })
generateUploadUrl({ spaceSlug: v.string() })
importFromUrl({ spaceSlug: v.string(), url: v.string() })
```

Resolve authorization before reading the recipe. Verify `recipe.spaceId === space._id`. Move routes under `/s/$spaceSlug/recipes`, pass the route param to every function, and build links with `spacePath.module`/typed TanStack params. Replace Group/share copy with Space ownership copy.

Register Recipes cleanup in `moduleLifecycle` to delete Space recipe rows and their owned storage objects. Do not delete global nutrition reference rows.

- [ ] **Step 5: Reset only the chosen development deployment**

Confirm the active Convex deployment name and that no production data is in scope. In the Convex dashboard, delete the development tables/data that violate the new schema, then run `pnpm exec convex dev --once`. Do not automate this destructive step and do not touch a production deployment.

Expected: new schema deploys with no legacy Group tables or ownership fields.

- [ ] **Step 6: Verify the migrated module**

Run: `pnpm exec vitest run convex/recipes.test.ts convex/recipeImport.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS with every Recipes call supplying `spaceSlug`.

- [ ] **Step 7: Commit**

```bash
git add convex src/routes/_app/s src/components src/routeTree.gen.ts
git add -u convex/groups.ts convex/lib/sharing.ts src/routes/_app/modules/recipes
git commit -m "feat: scope Recipes and data ownership to Spaces"
```

---

### Task 10: Replace the Busy Shell with Space Navigation and All Modules

**Files:**
- Modify: `src/components/shell/AppShell.tsx`
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/shell/MobileDock.tsx`
- Modify: `src/components/shell/CommandPalette.tsx`
- Modify: `src/components/shell/Topbar.tsx`
- Create: `src/components/spaces/SpaceSwitcher.tsx`
- Create: `src/components/modules/AllModules.tsx`
- Create: `src/components/modules/AllModules.test.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/modules.tsx`
- Delete: `src/components/shell/GroupInspector.tsx`
- Delete: `src/components/shell/CommandFeed.tsx`
- Modify/delete: tests owned by removed shell components

**Interfaces:**
- Consumes `useSpace`, module selectors, and `spacePath`.
- Sidebar order: Space switcher, Home, visible pins, All, then Members and Settings.
- All Modules: on mobile, overflow pins first followed by enabled live module tiles; on desktop, one responsive enabled-module grid.

- [ ] **Step 1: Write shell visibility tests**

```tsx
it("does not render archived or coming-soon modules in ordinary navigation", () => {
  renderSidebar(spaceContext({ visibleModuleIds: ["recipes"], pinnedModuleIds: ["recipes", "calendar"] }));
  expect(screen.getByRole("link", { name: "Recipes" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
});

it("keeps unpinned enabled modules reachable from All", () => {
  renderAllModules(spaceContext({ visibleModuleIds: ["recipes", "notes"], pinnedModuleIds: ["recipes"] }));
  expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/s/wine/notes");
});
```

- [ ] **Step 2: Run shell tests and confirm old-shell failures**

Run: `pnpm exec vitest run src/components/modules/AllModules.test.tsx src/components/shell/Sidebar.test.tsx src/components/shell/MobileDock.test.tsx`

Expected: FAIL because the current shell has global navigation, a third column, and fixed mobile destinations.

- [ ] **Step 3: Implement the calm two-column shell**

Remove the right inspector/feed column and all hard-coded preview Group content. `AppShell` renders only responsive Sidebar + main content + MobileDock + command palette. The shell must not fetch module domain records.

`SpaceSwitcher` changes both active Clerk organization and route. When the current suffix points to a route unavailable in the destination Space, navigate to its Home instead. Include “Create or join a Space” linking to onboarding.

- [ ] **Step 4: Implement responsive destination derivation**

Desktop uses all visible pins. Mobile uses exactly `buildMobileDock(visiblePins)` and therefore at most five items. All remains present even with zero pins. Active state treats module routes hidden from the dock as All active. Use accessible labels on icon-only compact controls.

The command palette contains Home, visible enabled modules, All, and Space admin destinations permitted by role. It never includes coming-soon or archived module routes.

- [ ] **Step 5: Implement All Modules**

Add a local search input that filters by module label/description. Render only enabled live modules. On mobile, render overflow pins (`visiblePins.slice(3)`) under “More from your menu”, then the full enabled grid without duplicate destinations. Admins see “Manage modules”; members do not.

- [ ] **Step 6: Verify shell tests and visual breakpoints**

Run: `pnpm exec vitest run src/components/modules/AllModules.test.tsx src/components/shell/Sidebar.test.tsx src/components/shell/MobileDock.test.tsx`

Expected: PASS.

Run the app and inspect 390px, 768px, and 1440px widths. Expected: no third column; no horizontal overflow; mobile has no more than five dock destinations; every visible module is reachable through All.

- [ ] **Step 7: Commit**

```bash
git add src/components/shell src/components/spaces/SpaceSwitcher.tsx src/components/modules src/routes/_app/s/$spaceSlug/modules.tsx
git commit -m "feat: add calm Space-specific navigation"
```

---

### Task 11: Build Space Administration Screens

**Files:**
- Create: `src/components/settings/ModuleSettings.tsx`
- Create: `src/components/settings/ModuleSettings.test.tsx`
- Create: `src/components/settings/NavigationSettings.tsx`
- Create: `src/components/settings/NavigationSettings.test.tsx`
- Create: `src/components/settings/SpaceMembers.tsx`
- Create: `src/components/settings/SpaceMembers.test.tsx`
- Create: `src/components/settings/SpaceSettings.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/members.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/settings/index.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/settings/modules.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/settings/navigation.tsx`

**Interfaces:**
- Admin module controls call Task 7 APIs; member navigation controls call `spacePreferences` APIs.
- Member management calls Task 6 actions and displays Clerk as source of truth.
- Navigation editor saves an ordered snapshot; reset deletes the personal snapshot.

- [ ] **Step 1: Write role and catalog tests**

```tsx
it("shows coming-soon modules only to admins in module settings", () => {
  const { rerender } = renderModuleSettings({ role: "member" });
  expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  rerender(<ModuleSettingsForTest role="admin" />);
  expect(screen.getByText("Calendar")).toBeInTheDocument();
  expect(screen.getByText("Enabled automatically when available")).toBeInTheDocument();
});
```

- [ ] **Step 2: Write navigation snapshot tests**

```tsx
it("saves ordered pins and can reset to the Space default", async () => {
  await moveItem("Notes", "up");
  await user.click(screen.getByRole("button", { name: "Save my menu" }));
  expect(saveNavigation).toHaveBeenCalledWith({ spaceSlug: "home", pinnedModuleIds: ["notes", "tasks"] });
  await user.click(screen.getByRole("button", { name: "Use Space default" }));
  expect(resetNavigation).toHaveBeenCalledWith({ spaceSlug: "home" });
});
```

- [ ] **Step 3: Run focused tests and confirm failures**

Run: `pnpm exec vitest run src/components/settings/ModuleSettings.test.tsx src/components/settings/NavigationSettings.test.tsx src/components/settings/SpaceMembers.test.tsx`

Expected: FAIL because settings components do not exist.

- [ ] **Step 4: Implement module administration**

Admins see live and coming-soon catalog sections. Live controls are Enable/Archive; archived modules show retained-data text and a separate permanent-delete disclosure with exact confirmation. Coming-soon defaults show pre-enabled status and a control to opt out by archiving; non-default coming-soon modules can be pre-enabled by the admin so they surface when live. Members navigating directly to admin settings receive an in-app “Admin access required” state and no mutation controls.

- [ ] **Step 5: Implement shared and personal navigation editors**

Admin mode edits `spaces.defaultPinnedModuleIds`; personal mode edits `spacePreferences.pinnedModuleIds`. Both list visible enabled modules only, provide Add/Remove and Move up/Move down keyboard-accessible buttons, show a mobile preview of Home + first three pins + All, and save explicitly. Personal mode shows whether it is inheriting or customized and offers “Use Space default”.

Add an admin mutation `spaces.saveDefaultNavigation({ spaceSlug, pinnedModuleIds })` using the same validation as personal preferences.

- [ ] **Step 6: Implement member and Space lifecycle screens**

Members screen lists Clerk-projected name/email/role, pending Clerk invitations, and admin-only invite, revoke, promote/demote, remove, and reconcile controls. Disable demote/remove for the last admin and still rely on server enforcement. Space settings supports rename and a danger zone for resumable Space deletion using exact confirmation `DELETE <SPACE NAME>`.

- [ ] **Step 7: Verify settings tests**

Run: `pnpm exec vitest run src/components/settings/ModuleSettings.test.tsx src/components/settings/NavigationSettings.test.tsx src/components/settings/SpaceMembers.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/settings src/routes/_app/s/$spaceSlug/members.tsx src/routes/_app/s/$spaceSlug/settings convex/spaces.ts convex/spaces.test.ts convex/_generated
git commit -m "feat: add Space administration screens"
```

---

### Task 12: Build the Widget Dashboard and Editors

**Files:**
- Create: `src/components/dashboard/WidgetDashboard.tsx`
- Create: `src/components/dashboard/WidgetDashboard.test.tsx`
- Create: `src/components/dashboard/WidgetFrame.tsx`
- Create: `src/components/dashboard/WidgetErrorBoundary.tsx`
- Create: `src/components/dashboard/DashboardEditor.tsx`
- Create: `src/components/dashboard/DashboardEditor.test.tsx`
- Create: `src/components/dashboard/WidgetLibrary.tsx`
- Create: `src/components/dashboard/widgetRenderers.ts`
- Modify: `src/routes/_app/s/$spaceSlug/home.tsx`
- Modify: `src/routes/_app/s/$spaceSlug/settings/dashboard.tsx`
- Modify: module-owned widget renderer files from merged Tasks/Notes/Calendar work only to register existing renderers
- Modify: `convex/spaces.ts`
- Modify: `convex/spaces.test.ts`

**Interfaces:**
- Renderer registry type: `Record<string, React.ComponentType<{ instance: WidgetInstance; spaceSlug: string }>>`.
- Personal saves call `spacePreferences.saveDashboard`; reset calls `resetDashboard`.
- Admin saves call `spaces.saveDefaultDashboard({ spaceSlug, dashboard })`.

- [ ] **Step 1: Write ordered rendering and isolation tests**

```tsx
it("renders widgets in snapshot order and applies size classes", () => {
  renderDashboard([
    { instanceId: "b", widgetDefinitionId: "notes.recent", size: "wide" },
    { instanceId: "a", widgetDefinitionId: "tasks.today", size: "compact" },
  ]);
  expect(screen.getAllByTestId("widget").map((node) => node.dataset.instance)).toEqual(["b", "a"]);
  expect(screen.getAllByTestId("widget")[0]).toHaveClass("widget-wide");
});

it("contains one widget failure without blanking Home", () => {
  renderDashboardWithThrowingWidget();
  expect(screen.getByText("This widget could not load")).toBeInTheDocument();
  expect(screen.getByText("Healthy widget")).toBeInTheDocument();
});
```

- [ ] **Step 2: Write editor snapshot tests**

```tsx
it("duplicates only widgets whose definition allows multiples", async () => {
  await user.click(screen.getByRole("button", { name: "Add Upcoming events" }));
  expect(screen.getByRole("button", { name: "Add Upcoming events" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Add Note" }));
  expect(screen.getByRole("button", { name: "Add Note" })).toBeEnabled();
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `pnpm exec vitest run src/components/dashboard/WidgetDashboard.test.tsx src/components/dashboard/DashboardEditor.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 4: Implement the dashboard renderer**

Render the effective ordered snapshot in a CSS grid. Map `compact` to one column unit, `standard` to two, and `wide` to the full row at desktop; collapse all sizes to one column on small screens. Skip widgets belonging to modules that are no longer visible and show no stale placeholders. Unknown renderer IDs render an isolated “Widget unavailable” frame with a Remove action only in edit mode.

Each widget is wrapped in `WidgetErrorBoundary` with retry. Do not let one module import/failure crash Home.

- [ ] **Step 5: Implement personal and admin editors**

The library lists widgets only from visible enabled modules. Editor operations are Add, Remove, Move up, Move down, and Size select limited to `allowedSizes`. Generate `instanceId` with `crypto.randomUUID()`. Personal editor works on a local clone and has Save/Cancel/Use Space default. Admin editor has Save/Cancel and updates the shared default without changing existing personal snapshots.

Add `spaces.saveDefaultDashboard` with admin authorization and Task 7's widget validation.

- [ ] **Step 6: Integrate parallel module renderers without domain duplication**

Inspect the merged Tasks, Notes, and Calendar modules. Register their exported widget components under their catalog definition IDs. If a module remains coming soon or has no renderer, keep its widgets out of the library and default dashboard. Do not create substitute task, note, calendar, or nutrition providers in this task.

- [ ] **Step 7: Verify dashboard tests and responsive layout**

Run: `pnpm exec vitest run src/components/dashboard/WidgetDashboard.test.tsx src/components/dashboard/DashboardEditor.test.tsx convex/spacePreferences.test.ts convex/spaces.test.ts`

Expected: PASS.

Inspect 390px and 1440px widths. Expected: one-column mobile ordering; compact/standard/wide desktop spans; no drag handles or x/y coordinate persistence.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard src/routes/_app/s/$spaceSlug/home.tsx src/routes/_app/s/$spaceSlug/settings/dashboard.tsx src/lib/modules.ts convex/spaces.ts convex/spaces.test.ts convex/_generated
git commit -m "feat: add customizable Space dashboards"
```

---

### Task 13: Remove Legacy UI, Add Redirects, and Verify the Whole Product

**Files:**
- Create: `src/components/spaces/LegacySpaceRedirect.tsx`
- Create: `src/components/spaces/LegacySpaceRedirect.test.tsx`
- Replace with redirects or delete: `src/routes/_app/dashboard.tsx`
- Replace with redirects or delete: `src/routes/_app/groups.tsx`
- Replace with redirects or delete: `src/routes/_app/settings.tsx`
- Replace with redirects or delete: old global placeholder/module routes under `src/routes/_app/modules`
- Modify: `src/lib/appNavigation.ts` or delete it if all consumers use Space selectors
- Delete: `src/components/modules/ModulePlaceholder.tsx` if no admin-catalog consumer remains
- Modify: all remaining tests/copy containing `Group`, `Command Center`, or global module paths
- Modify: `CLAUDE.md`
- Modify: `.env.example` only if it documents Convex-dashboard secret names without values

**Interfaces:**
- `LegacySpaceRedirect` selects the active/first accessible Space and redirects old bookmarks to `/s/:spaceSlug/home` or the matching live module route.
- Unknown/disabled legacy module paths redirect to All, not a coming-soon placeholder.

- [ ] **Step 1: Write redirect tests**

```tsx
it("redirects /dashboard to the active Space Home", async () => {
  renderLegacyRedirect({ from: "/dashboard", activeSpace: { slug: "wine" } });
  expect(navigate).toHaveBeenCalledWith({ to: "/s/$spaceSlug/home", params: { spaceSlug: "wine" }, replace: true });
});

it("sends a disabled legacy module route to All", async () => {
  renderLegacyRedirect({ from: "/calendar", activeSpace: { slug: "wine" }, visibleModuleIds: [] });
  expect(navigate).toHaveBeenCalledWith({ to: "/s/$spaceSlug/modules", params: { spaceSlug: "wine" }, replace: true });
});
```

- [ ] **Step 2: Run redirect tests and confirm failure**

Run: `pnpm exec vitest run src/components/spaces/LegacySpaceRedirect.test.tsx`

Expected: FAIL because redirect component does not exist.

- [ ] **Step 3: Implement redirects and delete dead global UI**

Keep small route wrappers only for bookmarks that existed in the current app. Do not expose duplicate global pages in navigation. Delete legacy group creation/join UI, command-center feed/inspector remnants, and placeholder module pages from ordinary routes. Preserve `/account` as a user-global Clerk profile route.

- [ ] **Step 4: Run static copy/path audits**

Run:

```bash
rg -n "Group|groupId|sharedGroupIds|defaultGroupId|Command Center|/dashboard|/modules/recipes" src convex --glob '!routeTree.gen.ts'
```

Expected: no production matches except intentional legacy redirect input strings and lower-level Clerk documentation/tests that explicitly describe migration history. Fix each other match to Space terminology or Space-scoped routes.

Run:

```bash
rg -n "comingSoon|preEnabled" src/components src/routes
```

Expected: matches occur only in admin module settings or selector tests, never Sidebar, MobileDock, command palette, dashboard, or ordinary All Modules rendering.

- [ ] **Step 5: Generate routes and run the complete automated suite**

Run:

```bash
pnpm run generate-routes
pnpm run check
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: every command exits 0. Inspect failures rather than weakening or skipping checks.

- [ ] **Step 6: Execute the end-to-end acceptance matrix**

Use two test users, two Clerk Organizations, one admin, and one member:

1. New user with no memberships sees create-or-join onboarding and no auto-created Home Space.
2. Admin creates “Wine Club”; URL becomes `/s/wine-club/home`; Clerk active organization and Convex identity claims match.
3. Admin invites member; member accepts; both see the same Space data.
4. Member cannot access module/member/Space admin mutations by direct UI or direct Convex call.
5. Admin enables Recipes; it appears in All; pinning it adds it to desktop and mobile within the five-item cap.
6. An enabled unpinned module remains reachable from All.
7. Admin archives Recipes; navigation/widgets disappear while recipe rows remain. Re-enable restores access and data.
8. Permanent delete requires exact confirmation, deletes only that Space's Recipes data, and remains retryable after a forced cleanup failure.
9. Admin changes shared pins/dashboard; a member without overrides follows them; a member with snapshots remains unchanged until reset.
10. Switching Spaces updates Clerk active organization before any destination data renders; a forged Space slug is rejected server-side.
11. Coming-soon modules appear only in admin settings. A default `preEnabled` module becomes visible automatically when its catalog availability is changed to `live` in a test fixture.
12. Last admin cannot demote/remove themselves. Reconciliation repairs a deliberately stale Convex membership projection.
13. Space deletion completes Clerk + Convex cleanup and a retry after an injected partial failure completes safely.
14. Legacy bookmarks redirect to active Space Home, matching visible module, or All.
15. 390px mobile view has at most five dock items; 1440px desktop view has no inspector/feed column.

Record any Clerk/Convex dashboard configuration completed in `docs/setup/clerk-spaces.md`; never commit secret values.

- [ ] **Step 7: Update project documentation**

In `CLAUDE.md`, replace obsolete Group/domain notes with: Space terminology, Clerk Organization role ownership, required Convex deployment environment variables, Space route convention, development reset note, and the module/widget registration contracts. State that new modules must register catalog metadata, Space authorization, cleanup, routes, and optional widgets.

- [ ] **Step 8: Commit final cleanup**

```bash
git add src convex docs/setup/clerk-spaces.md CLAUDE.md .env.example
git commit -m "refactor: complete the Space-centered Gather experience"
```

---

## Execution Notes

- Tasks are ordered because authorization must exist before Space queries, Space context before navigation, module state before widgets, and Space routes before the Recipes ownership reset. Do not parallelize tasks that touch these shared contracts.
- Within a task, tests and implementation may be split among workers only when they do not edit the same files. The task's final reviewer must run the entire command listed for that task.
- Before Task 2 and again before Task 12, inspect merged work from Tasks, Notes, Calendar, and nutrition sessions. Integrate exported definitions/providers; do not recreate them.
- The temporary coexistence of additive Space tables and legacy Group tables between Tasks 3 and 9 is an implementation sequence only. No code should dual-read or dual-write them, and the finished branch must contain no legacy tables.
- Use `superpowers:verification-before-completion` before claiming the implementation is finished, then `superpowers:requesting-code-review` and `superpowers:finishing-a-development-branch` for handoff.

## Primary References

- Approved design: `docs/superpowers/specs/2026-07-17-space-centered-gather-design.md`
- Clerk Organizations overview: <https://clerk.com/docs/guides/organizations/overview>
- Clerk session token customization: <https://clerk.com/docs/guides/sessions/session-tokens>
- Clerk webhook verification: <https://clerk.com/docs/reference/backend/verify-webhook>
- Clerk webhook synchronization: <https://clerk.com/docs/guides/development/webhooks/syncing>
- Clerk React organization list hook: <https://clerk.com/docs/tanstack-react-start/reference/hooks/use-organization-list>
- Convex authorization identity: <https://docs.convex.dev/auth/functions-auth>
- Convex function testing: <https://docs.convex.dev/testing/convex-test>
- Vitest projects: <https://vitest.dev/guide/workspace.html>
