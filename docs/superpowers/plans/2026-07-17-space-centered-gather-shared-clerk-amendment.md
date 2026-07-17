# Shared Clerk Application Implementation Plan Amendment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate Gather Spaces inside a Clerk application shared with other webapps, without changing those apps' sign-in flow, importing their Organizations, or breaking shared JWT consumers.

**Architecture:** Gather-owned Clerk Organizations and invitations receive backend-written, versioned public metadata markers. An idempotent backend action creates marked Organizations, while frontend selection, webhook projection, reconciliation, and destructive actions accept only marked or already-known Gather resources. Clerk remains membership-optional globally; Gather alone enforces create-or-join.

**Tech Stack:** TypeScript, Clerk React, Clerk Backend SDK, Convex actions/mutations/HTTP actions, Vitest, `convex-test`, pnpm.

## Global Constraints

- This document is mandatory alongside `2026-07-17-space-centered-gather.md` and `2026-07-17-space-centered-gather-audit.md`; it overrides their shared-Clerk assumptions.
- Execute base Tasks 1–2, then apply Amendment Tasks A1–A5 at the base-task integration points listed below.
- Configure Clerk Organizations as membership optional. Retain Personal Accounts and disable automatic first-Organization creation.
- Do not enable Clerk's membership-required session task.
- Do not delete, rename, remap, or restrict shared Clerk roles. Gather assigns and authorizes only `org:admin` and `org:member` for marked Gather Organizations.
- Do not project, list, reconcile, mutate, or delete another product's unmarked Organization or invitation.
- Do not use Clerk's frontend `createOrganization()` helper for Gather.
- Add `org_id` and `org_role` to the shared `convex` JWT template only after every known consumer passes before-change and after-change authenticated smoke tests.
- Preserve all existing claims and JWT template settings.
- If another consumer fails, stop before deployment; do not weaken its validation or ship a partially compatible template.

## Integration Order

1. Base Tasks 1–2.
2. Base Task 3 plus Amendment Task A1.
3. Base Task 4 plus Amendment Task A2, which supersedes `spaces.ensureActive` and empty new-Space defaults.
4. Base Task 5 plus Amendment Task A3, which supersedes processing all Clerk Organization events.
5. Base Task 6 plus the invitation and destructive-action requirements in Amendment Tasks A2–A3.
6. Base Task 7.
7. Base Task 8 plus Amendment Task A4, which supersedes frontend Organization creation and unfiltered membership/invitation lists.
8. Base Task 9.
9. Base Task 10 plus Amendment Task A4's Space-switcher filtering.
10. Base Tasks 11–12.
11. Base Task 13 plus Amendment Task A5.

## Added File Responsibilities

- `shared/gatherOrganizations.ts` — dependency-free marker constants, strict metadata guards, request-ID validation, and deterministic Clerk slug creation; imported by both React and Convex.
- `shared/gatherOrganizations.test.ts` — pure marker/slug tests.
- `convex/lib/clerkOrganizationGateway.ts` — focused real/fake gateway interface for Clerk Organization creation and marker lookup.
- `convex/lib/gatherOrganizationCreation.ts` — idempotent find-or-create orchestration with no Convex or React imports.
- `convex/lib/gatherOrganizationCreation.test.ts` — fake-gateway tests for retries and ownership conflicts.
- `docs/setup/clerk-shared-application.md` — exact shared-instance configuration, cross-app inventory method, and recorded compatibility results without secrets or token bodies.

---

### Task A1: Add the Shared Product-Marker Contract

**Integration point:** Execute during base Task 3 before adding Space authorization.

**Files:**
- Create: `shared/gatherOrganizations.ts`
- Create: `shared/gatherOrganizations.test.ts`
- Modify: `convex/lib/spaceAuth.ts`
- Modify: `convex/lib/spaceAuth.test.ts`
- Create: `docs/setup/clerk-shared-application.md`
- Modify: `docs/setup/clerk-spaces.md`

**Interfaces:**
- Produces `GATHER_ORGANIZATION_MARKER`, `GATHER_INVITATION_MARKER`, `isGatherOrganizationMetadata`, `isGatherInvitationMetadata`, `assertGatherRequestId`, and `gatherClerkSlug`.
- `gatherClerkSlug(requestId)` returns `gather-${requestId.toLowerCase()}`.
- Metadata guards accept unrelated metadata keys but require exact Gather `kind` and integer `schemaVersion: 1`.

- [ ] **Step 1: Write marker-recognition tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  GATHER_INVITATION_MARKER,
  GATHER_ORGANIZATION_MARKER,
  gatherClerkSlug,
  isGatherInvitationMetadata,
  isGatherOrganizationMetadata,
} from './gatherOrganizations'

describe('Gather Clerk resource markers', () => {
  it('recognizes a Gather Organization while allowing unrelated metadata', () => {
    expect(isGatherOrganizationMetadata({
      ...GATHER_ORGANIZATION_MARKER,
      billing: { tier: 'free' },
    })).toBe(true)
  })

  it.each([
    undefined,
    {},
    { gather: { kind: 'spaceInvitation', schemaVersion: 1 } },
    { gather: { kind: 'space', schemaVersion: 2 } },
    { gather: { kind: 'space', schemaVersion: '1' } },
  ])('rejects non-Gather Organization metadata: %j', (metadata) => {
    expect(isGatherOrganizationMetadata(metadata)).toBe(false)
  })

  it('recognizes only marked Gather invitations', () => {
    expect(isGatherInvitationMetadata(GATHER_INVITATION_MARKER)).toBe(true)
    expect(isGatherInvitationMetadata(GATHER_ORGANIZATION_MARKER)).toBe(false)
  })

  it('derives a stable Clerk slug from a UUID', () => {
    expect(gatherClerkSlug('88A58CD8-9C7D-4C93-A713-7B17384FE681'))
      .toBe('gather-88a58cd8-9c7d-4c93-a713-7b17384fe681')
  })
})
```

- [ ] **Step 2: Run the pure test and confirm failure**

Run: `pnpm exec vitest run shared/gatherOrganizations.test.ts`

Expected: FAIL because `shared/gatherOrganizations.ts` does not exist.

- [ ] **Step 3: Implement the marker contract**

```ts
export const GATHER_ORGANIZATION_MARKER = {
  gather: { kind: 'space', schemaVersion: 1 },
} as const

export const GATHER_INVITATION_MARKER = {
  gather: { kind: 'spaceInvitation', schemaVersion: 1 },
} as const

function hasGatherMarker(
  metadata: unknown,
  kind: 'space' | 'spaceInvitation',
): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  const gather = (metadata as Record<string, unknown>).gather
  if (!gather || typeof gather !== 'object') return false
  const value = gather as Record<string, unknown>
  return value.kind === kind && value.schemaVersion === 1
}

export function isGatherOrganizationMetadata(metadata: unknown): boolean {
  return hasGatherMarker(metadata, 'space')
}

export function isGatherInvitationMetadata(metadata: unknown): boolean {
  return hasGatherMarker(metadata, 'spaceInvitation')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertGatherRequestId(requestId: string): void {
  if (!UUID_PATTERN.test(requestId)) throw new Error('A valid Space creation request ID is required')
}

export function gatherClerkSlug(requestId: string): string {
  assertGatherRequestId(requestId)
  return `gather-${requestId.toLowerCase()}`
}
```

- [ ] **Step 4: Restrict role parsing without modifying Clerk's catalog**

`readSpaceClaims` continues normalizing only `org:admin`/`admin` and `org:member`/`member`. Add a test proving `org:editor` is rejected with `Unsupported Gather Space role`. Do not add dashboard instructions to delete that role; it may belong to another product.

- [ ] **Step 5: Document shared-instance configuration**

`docs/setup/clerk-shared-application.md` must state:

1. Organizations: enabled, membership optional.
2. Personal Accounts: enabled.
3. Automatic first Organization: disabled.
4. Shared roles: unchanged; Gather uses admin/member only.
5. Gather metadata marker and invitation marker exactly as above.
6. Shared JWT template: additive changes only after compatibility evidence.
7. Other webapps that display Organizations must apply their own namespace filter.
8. Never paste JWT bodies, publishable keys, secret keys, or webhook secrets into the document.

- [ ] **Step 6: Verify and commit**

Run: `pnpm exec vitest run shared/gatherOrganizations.test.ts convex/lib/spaceAuth.test.ts`

Expected: PASS.

```bash
git add shared/gatherOrganizations.ts shared/gatherOrganizations.test.ts convex/lib/spaceAuth.ts convex/lib/spaceAuth.test.ts docs/setup/clerk-shared-application.md docs/setup/clerk-spaces.md
git commit -m "feat: define Gather Clerk resource markers"
```

---

### Task A2: Create Marked Organizations Idempotently

**Integration point:** Execute across base Tasks 4 and 6. This task replaces public `spaces.ensureActive` provisioning.

**Files:**
- Create: `convex/lib/clerkOrganizationGateway.ts`
- Create: `convex/lib/gatherOrganizationCreation.ts`
- Create: `convex/lib/gatherOrganizationCreation.test.ts`
- Modify: `convex/spaceAdmin.ts`
- Modify: `convex/spaceAdmin.test.ts`
- Modify: `convex/spaces.ts`
- Modify: `convex/spaces.test.ts`

**Interfaces:**
- Produces action `spaceAdmin.create({ name, requestId })` returning `{ clerkOrganizationId, spaceSlug }`.
- Produces internal mutation `spaces.provisionTagged({ clerkOrganizationId, clerkOrganizationName, creatorClerkUserId })`.
- Produces public mutation `spaces.ensureMembershipProjection({ spaceSlug })`; it requires an existing Space mapping.
- Removes public provisioning semantics from `spaces.ensureActive`; delete that function and update all consumers.

- [ ] **Step 1: Write retry and ownership tests against a fake gateway**

```ts
it('reuses the same marked Organization when a request is retried', async () => {
  const gateway = new FakeClerkOrganizationGateway()
  const input = {
    name: 'Wine Club',
    requestId: '88a58cd8-9c7d-4c93-a713-7b17384fe681',
    creatorClerkUserId: 'user_eric',
  }

  const first = await findOrCreateGatherOrganization(gateway, input)
  const second = await findOrCreateGatherOrganization(gateway, input)

  expect(second.id).toBe(first.id)
  expect(gateway.createCalls).toHaveLength(1)
})

it('rejects a deterministic slug owned by another user', async () => {
  const gateway = new FakeClerkOrganizationGateway([
    markedOrganization({ slug: 'gather-88a58cd8-9c7d-4c93-a713-7b17384fe681', createdBy: 'user_other' }),
  ])
  await expect(findOrCreateGatherOrganization(gateway, {
    name: 'Wine Club',
    requestId: '88a58cd8-9c7d-4c93-a713-7b17384fe681',
    creatorClerkUserId: 'user_eric',
  })).rejects.toThrow('Space creation request is already owned by another user')
})
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm exec vitest run convex/lib/gatherOrganizationCreation.test.ts`

Expected: FAIL because the creation orchestrator does not exist.

- [ ] **Step 3: Implement the focused Clerk gateway and orchestrator**

```ts
export interface ClerkOrganizationRecord {
  id: string
  name: string
  slug: string
  createdBy: string | null
  publicMetadata: unknown
}

export interface ClerkOrganizationGateway {
  getBySlug(slug: string): Promise<ClerkOrganizationRecord | null>
  getById(id: string): Promise<ClerkOrganizationRecord | null>
  create(input: {
    name: string
    slug: string
    createdBy: string
    publicMetadata: typeof GATHER_ORGANIZATION_MARKER
  }): Promise<ClerkOrganizationRecord>
}
```

`findOrCreateGatherOrganization` derives the slug, reuses only a marked record created by the same user, and otherwise calls `gateway.create` with `GATHER_ORGANIZATION_MARKER`. Catch only Clerk's not-found response in `getBySlug`; surface rate limits, authentication failures, and network errors.

- [ ] **Step 4: Implement `spaceAdmin.create`**

```ts
export const create = action({
  args: { name: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    const name = normalizeSpaceName(args.name)
    const organization = await findOrCreateGatherOrganization(
      createRealClerkOrganizationGateway(requireEnv('CLERK_SECRET_KEY')),
      { name, requestId: args.requestId, creatorClerkUserId: identity.subject },
    )
    const projection = await ctx.runMutation(internal.spaces.provisionTagged, {
      clerkOrganizationId: organization.id,
      clerkOrganizationName: organization.name,
      creatorClerkUserId: identity.subject,
    })
    return { clerkOrganizationId: organization.id, spaceSlug: projection.spaceSlug }
  },
})
```

`provisionTagged` is idempotent by Clerk Organization ID and initializes the non-empty Tasks/Notes/Calendar defaults required by the base-plan audit.

- [ ] **Step 5: Prevent active other-product Organizations from being claimed**

Replace `spaces.ensureActive` with:

```ts
export const ensureMembershipProjection = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    const claims = readSpaceClaims(identity)
    const space = await findSpaceBySlug(ctx, args.spaceSlug)
    if (!space || space.clerkOrganizationId !== claims.clerkOrganizationId) {
      throw new ConvexError('Active organization is not a Gather Space')
    }
    const user = await requireUser(ctx)
    await upsertMembershipProjection(ctx, {
      spaceId: space._id,
      userId: user._id,
      clerkUserId: identity.subject,
      role: claims.role,
      now: Date.now(),
    })
    return { spaceId: space._id }
  },
})
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm exec vitest run convex/lib/gatherOrganizationCreation.test.ts convex/spaceAdmin.test.ts convex/spaces.test.ts`

Expected: PASS, including a test that an active unmarked Organization cannot create a Space through `ensureMembershipProjection`.

```bash
git add convex/lib/clerkOrganizationGateway.ts convex/lib/gatherOrganizationCreation.ts convex/lib/gatherOrganizationCreation.test.ts convex/spaceAdmin.ts convex/spaceAdmin.test.ts convex/spaces.ts convex/spaces.test.ts convex/_generated
git commit -m "feat: create marked Gather Organizations safely"
```

---

### Task A3: Filter Webhooks, Invitations, Reconciliation, and Destructive Actions

**Integration point:** Execute during base Tasks 5–6.

**Files:**
- Modify: `convex/clerkWebhook.ts`
- Modify: `convex/clerkWebhook.test.ts`
- Modify: `convex/clerkSync.ts`
- Modify: `convex/clerkSync.test.ts`
- Modify: `convex/lib/clerkEvents.ts`
- Modify: `convex/spaceAdmin.ts`
- Modify: `convex/spaceAdmin.test.ts`

**Interfaces:**
- Produces `classifyClerkEvent(ctx, verifiedEvent): Promise<ClerkProjectionEvent | null>`.
- `null` means acknowledged unrelated event with no writes.
- Every invitation created by `spaceAdmin.invite` includes `GATHER_INVITATION_MARKER`.

- [ ] **Step 1: Write unrelated-event rejection tests**

```ts
test('acknowledges an unmarked Organization without projecting it', async () => {
  const response = await fetchVerifiedWebhook(t, organizationCreatedEvent({
    id: 'org_other_product',
    publicMetadata: { otherProduct: { kind: 'workspace' } },
  }))
  expect(response.status).toBe(200)
  expect(await findSpaceByOrganization(t, 'org_other_product')).toBeNull()
})

test('ignores a membership for an unknown unmarked Organization', async () => {
  clerkGateway.seed(unmarkedOrganization({ id: 'org_other_product' }))
  await applyVerifiedEvent(t, membershipCreatedEvent({ organizationId: 'org_other_product' }))
  expect(await allMemberships(t)).toEqual([])
})

test('updates a shared user only when the user has a Gather membership', async () => {
  await applyVerifiedEvent(t, userUpdatedEvent({ id: 'user_other_product', firstName: 'Other' }))
  expect(await findUserByClerkId(t, 'user_other_product')).toBeNull()
})
```

- [ ] **Step 2: Run focused tests and observe failure**

Run: `pnpm exec vitest run convex/clerkWebhook.test.ts convex/clerkSync.test.ts`

Expected: FAIL because the base plan projects every Organization/user event.

- [ ] **Step 3: Implement event classification after signature verification**

Apply this decision table:

| Event | Accept when |
|---|---|
| Organization create/update | verified payload has `GATHER_ORGANIZATION_MARKER` |
| Organization delete | immutable Organization ID already maps to `spaces` |
| Membership create/update | Organization ID maps to `spaces`, or Backend lookup returns marked Organization |
| Membership delete | membership ID or Organization ID maps to Gather projection data |
| User create/update | user already has at least one `spaceMemberships` row |
| Invitation | verified payload has `GATHER_INVITATION_MARKER` |

Classification must occur only after `verifyWebhook` succeeds. An ignored verified event returns 200 and schedules no mutation. An invalid signature returns 400 and performs no reads or writes.

- [ ] **Step 4: Mark invitations and constrain administrative actions**

`spaceAdmin.invite` must call Clerk with:

```ts
await clerk.organizations.createOrganizationInvitation({
  organizationId: space.clerkOrganizationId,
  inviterUserId: identity.subject,
  emailAddress,
  role: 'org:member',
  publicMetadata: GATHER_INVITATION_MARKER,
  redirectUrl: `${publicAppOrigin}/onboarding`,
})
```

Before rename, invite, revoke, role change, removal, reconciliation, or deletion, fetch the exact Clerk Organization and require `isGatherOrganizationMetadata(organization.publicMetadata)`. A missing/malformed marker suspends the operation with `Gather Space marker mismatch`; never retag automatically.

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec vitest run convex/clerkWebhook.test.ts convex/clerkSync.test.ts convex/spaceAdmin.test.ts`

Expected: PASS for tagged events and no-write handling of every untagged negative control.

```bash
git add convex/clerkWebhook.ts convex/clerkWebhook.test.ts convex/clerkSync.ts convex/clerkSync.test.ts convex/lib/clerkEvents.ts convex/spaceAdmin.ts convex/spaceAdmin.test.ts convex/_generated
git commit -m "feat: isolate Gather Clerk events and actions"
```

---

### Task A4: Filter Onboarding, Invitations, Routes, and the Space Switcher

**Integration point:** Execute during base Tasks 8 and 10.

**Files:**
- Modify: `src/components/spaces/SpaceOnboarding.tsx`
- Modify: `src/components/spaces/SpaceOnboarding.test.tsx`
- Modify: `src/components/spaces/SpaceRouteGate.tsx`
- Modify: `src/components/spaces/SpaceRouteGate.test.tsx`
- Modify: `src/components/spaces/SpaceSwitcher.tsx`
- Create/modify: `src/components/spaces/SpaceSwitcher.test.tsx`

**Interfaces:**
- Onboarding create calls `api.spaceAdmin.create`, not Clerk frontend `createOrganization`.
- Membership filter: `isGatherOrganizationMetadata(membership.organization.publicMetadata)`.
- Invitation filter: `isGatherInvitationMetadata(invitation.publicMetadata)`.

- [ ] **Step 1: Write negative-control component tests**

```tsx
it('treats other-product memberships as absent from Gather', () => {
  renderOnboarding({
    memberships: [membership({ id: 'org_other', publicMetadata: { otherProduct: true } })],
    invitations: [],
  })
  expect(screen.getByRole('heading', { name: 'Create or join a Space' })).toBeInTheDocument()
  expect(screen.queryByText('Other Product Team')).not.toBeInTheDocument()
})

it('shows only marked Gather invitations', () => {
  renderOnboarding({
    memberships: [],
    invitations: [
      invitation({ name: 'Gather Wine Club', publicMetadata: GATHER_INVITATION_MARKER }),
      invitation({ name: 'Other Product Team', publicMetadata: {} }),
    ],
  })
  expect(screen.getByText('Gather Wine Club')).toBeInTheDocument()
  expect(screen.queryByText('Other Product Team')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Write retry-safe creation test**

```tsx
it('reuses the same request ID when Space creation is retried', async () => {
  mockCreateSpace.mockRejectedValueOnce(new Error('Projection unavailable')).mockResolvedValueOnce({
    clerkOrganizationId: 'org_wine',
    spaceSlug: 'wine-club',
  })
  renderOnboarding({ memberships: [], invitations: [] })
  await user.type(screen.getByLabelText('Space name'), 'Wine Club')
  await user.click(screen.getByRole('button', { name: 'Create Space' }))
  await user.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(mockCreateSpace.mock.calls[0][0].requestId).toBe(mockCreateSpace.mock.calls[1][0].requestId)
})
```

- [ ] **Step 3: Run focused tests and observe failure**

Run: `pnpm exec vitest run src/components/spaces/SpaceOnboarding.test.tsx src/components/spaces/SpaceRouteGate.test.tsx src/components/spaces/SpaceSwitcher.test.tsx`

Expected: FAIL because base onboarding uses unfiltered Clerk lists and frontend Organization creation.

- [ ] **Step 4: Implement filtered creation and joining**

Create flow:

1. generate `requestId` once when the user submits a valid name;
2. retain it in component state through retry;
3. call `spaceAdmin.create({ name, requestId })`;
4. call `setActive({ organization: result.clerkOrganizationId })`;
5. wait until Clerk and Convex identity carry that Organization;
6. navigate to `/s/${result.spaceSlug}/home`;
7. clear request ID only after success or when the user intentionally starts a different name.

Join flow lists only marked invitations, calls `invitation.accept()`, activates the returned Organization, and calls `spaces.ensureMembershipProjection` only for the existing Gather Space.

- [ ] **Step 5: Filter route activation and Space switching**

Derive `gatherMemberships` once from Clerk's paginated membership data. `SpaceRouteGate` and `SpaceSwitcher` may call `setActive` only when the target Space's `clerkOrganizationId` occurs in that filtered list. If the current active Organization belongs to another product, Gather remains signed in through the Personal Account and presents/selects Gather context without projecting it.

Pagination must continue until Clerk reports no more membership/invitation pages before declaring that the user has no Gather Spaces. Do not assume the first page contains a marked resource.

- [ ] **Step 6: Verify and commit**

Run: `pnpm exec vitest run src/components/spaces/SpaceOnboarding.test.tsx src/components/spaces/SpaceRouteGate.test.tsx src/components/spaces/SpaceSwitcher.test.tsx`

Expected: PASS, including first-page-unmarked/second-page-marked fixtures.

```bash
git add src/components/spaces src/routes/_app/onboarding.tsx src/routeTree.gen.ts
git commit -m "feat: filter Gather Space onboarding and switching"
```

---

### Task A5: Prove Cross-App Clerk Compatibility

**Integration point:** Execute before and during base Task 13 rollout verification.

**Files:**
- Modify: `docs/setup/clerk-shared-application.md`
- Modify: `docs/setup/clerk-spaces.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces documented compatibility evidence without credentials or raw token contents.
- Blocks shared JWT deployment when any known app fails.

- [ ] **Step 1: Inventory the shared Clerk consumers**

Using the Clerk publishable-key prefix, Clerk instance domain, deployment configuration, and repository search available to the implementer, identify every webapp using the same Clerk application. For each app, record only:

- app/repository name;
- development URL;
- whether it renders Organization UI;
- whether it requests the `convex` JWT template;
- the authenticated smoke path used; and
- result timestamp/status.

If the list cannot be established from accessible configuration, stop before changing Clerk and ask the owner for the authoritative app list. Do not assume Gather is the only consumer.

- [ ] **Step 2: Capture the before-change baseline**

For each inventoried app:

1. sign in with its development test user;
2. complete its main authenticated smoke path;
3. if it requests `convex`, decode one development token locally and record claim names only—not values or the token;
4. record PASS with timestamp in `docs/setup/clerk-shared-application.md`.

Expected: every app passes before the shared template changes.

- [ ] **Step 3: Apply only the additive Clerk configuration**

In the shared Clerk development instance:

1. enable Organizations as membership optional;
2. retain Personal Accounts;
3. disable automatic first-Organization creation;
4. leave roles and Role Sets unchanged;
5. preserve the entire existing `convex` template and add only:

```json
{
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}"
}
```

Expected: Clerk saves the configuration without removing existing claims.

- [ ] **Step 4: Repeat the compatibility matrix**

Repeat every before-change smoke path and token claim-name inspection. Also confirm a user with no active Organization still signs into every non-Gather app normally.

Expected: every app passes. If one fails, restore the prior development template/configuration immediately, record the failure without secrets, and stop implementation before production rollout.

- [ ] **Step 5: Run Gather negative controls**

In the shared Clerk development instance:

1. create one unmarked control Organization outside Gather;
2. create one marked Gather Space through Gather onboarding;
3. create one unmarked invitation and one Gather-marked invitation for the test user;
4. deliver/replay webhook events for both Organizations;
5. confirm Gather lists/projects only the marked resources;
6. confirm Gather cannot rename, reconcile, or delete the unmarked control;
7. confirm the other apps' authenticated smoke paths still pass.

- [ ] **Step 6: Run the full repository verification**

Run:

```bash
pnpm run check
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Update documentation and commit**

Add the shared-instance constraints, marker contract, backend-only Organization creation, and compatibility gate to `CLAUDE.md`. Record test outcomes in setup docs without keys, secrets, user data, Organization IDs, or token contents.

```bash
git add docs/setup/clerk-shared-application.md docs/setup/clerk-spaces.md CLAUDE.md
git commit -m "docs: record shared Clerk compatibility checks"
```

---

## Amendment Self-Review

- **Spec coverage:** membership-optional configuration, markers, idempotent creation, membership/invitation filtering, webhook isolation, role safety, shared-JWT compatibility, active other-product context, failure recovery, and negative-control tests all have execution tasks.
- **Placeholder scan:** the plan contains no deferred implementation decisions. The only legitimate execution gate is discovering the authoritative list of external Clerk consumers before mutating their shared configuration.
- **Type consistency:** `GATHER_ORGANIZATION_MARKER`, `GATHER_INVITATION_MARKER`, `spaceAdmin.create`, `spaces.provisionTagged`, and `spaces.ensureMembershipProjection` retain the same names and shapes across all tasks.
