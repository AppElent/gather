# Shared Clerk Application Amendment

**Date:** 2026-07-17
**Status:** Approved
**Amends:** `docs/superpowers/specs/2026-07-17-space-centered-gather-design.md`

## 1. Reason for the amendment

Gather shares its Clerk application instance with other webapps so those products use the same Clerk users and sessions. The original Space design correctly chose Clerk Organizations for membership, but incorrectly assumed every Organization, invitation, role setting, webhook event, and `convex` JWT consumer in the Clerk instance belonged to Gather.

This amendment is authoritative wherever it differs from sections 5, 6, 8, 13, 17, 18, or 19 of the base design.

## 2. Application-level safety boundary

Organizations, memberships, role definitions, JWT templates, webhook events, and Organization usage limits are shared across the Clerk application instance. Gather must coexist with other products instead of treating the Clerk instance as Gather-owned.

Clerk Organizations are configured as **membership optional**. Personal Accounts remain enabled and automatic first-Organization creation remains disabled. Gather enforces create-or-join inside Gather onboarding; it must not enable Clerk's application-wide membership-required session task, because that could block users entering the other webapps.

The shared Clerk role catalog is not modified, pruned, or renamed. Gather assigns and accepts only `org:admin` and `org:member` for Gather Spaces. A different signed role is unauthorized in Gather even if another product legitimately uses that role. A dedicated Role Set may be assigned to Gather Organizations when the Clerk plan already supports it, but this design does not require a paid Role Set.

## 3. Gather Organization and invitation markers

Every Gather-created Clerk Organization has this backend-written public metadata marker:

```ts
export const GATHER_ORGANIZATION_MARKER = {
  gather: {
    kind: 'space',
    schemaVersion: 1,
  },
} as const
```

Every Gather-created invitation has:

```ts
export const GATHER_INVITATION_MARKER = {
  gather: {
    kind: 'spaceInvitation',
    schemaVersion: 1,
  },
} as const
```

Public metadata is used because the frontend must filter Organization memberships and invitations, while only Gather's authenticated backend actions may write the markers. Gather never claims or retags an existing unmarked Organization.

An Organization is accepted as Gather-owned when either:

1. its current public metadata has the exact supported Gather Organization marker; or
2. its immutable Clerk Organization ID already maps to a Convex `spaces` record created from that marker.

The second condition supports deletion events and temporary Clerk API failures after a Space has already been established. It does not allow an arbitrary client to create the mapping.

## 4. Idempotent Space creation

Gather does not use Clerk's frontend `createOrganization()` helper. Creation goes through authenticated Convex action:

```ts
spaceAdmin.create({
  name: string,
  requestId: string,
}): Promise<{
  clerkOrganizationId: string
  spaceSlug: string
}>
```

The browser generates one UUID request ID and retains it across retries. The action:

1. requires a signed-in Clerk user but does not require an active Organization;
2. validates the request ID as a UUID;
3. derives deterministic internal Clerk slug `gather-<requestId>`;
4. looks up that Clerk slug before creating;
5. if absent, calls Clerk Backend `createOrganization()` with `name`, `createdBy: identity.subject`, the deterministic Clerk slug, and `GATHER_ORGANIZATION_MARKER`;
6. if present, verifies the Organization creator and Gather marker match the request before reusing it;
7. idempotently creates/repairs the Convex Space, default modules, creator membership projection, pins, and dashboard; and
8. returns the Clerk Organization ID and Gather's independent human-readable Space slug.

If Clerk succeeds but the Convex projection fails, retrying with the same request ID finds the same Clerk Organization and resumes projection. It never creates a second Organization. Gather's human-readable `/s/:spaceSlug` remains independent of the internal Clerk slug and does not change on rename.

After the action succeeds, onboarding calls Clerk `setActive({ organization: clerkOrganizationId })`, waits for a fresh token, loads the returned Gather Space, and navigates to Space Home.

## 5. Selection, joining, and activation

Gather filters `useOrganizationList()` memberships with `isGatherOrganization(organization.publicMetadata)`. It filters invitations with `isGatherInvitation(invitation.publicMetadata)`. Other-product Organizations and invitations do not count as Gather Spaces and never appear in Gather onboarding, the Space switcher, direct-route activation, or member management.

Having only other-product Organization memberships is equivalent to having no Gather Space: Gather presents its create-or-join screen while the Clerk Personal Account remains valid.

Gather invitations are created only through `spaceAdmin.invite`, which always writes `GATHER_INVITATION_MARKER`. Accepting one activates its Organization and loads the existing Gather Space. If the membership webhook is delayed, `spaces.ensureMembershipProjection({ spaceSlug })` may repair only the current signed user's membership for an Organization already mapped to a Gather Space. It cannot provision or claim an unknown Organization.

Opening `/s/:spaceSlug/...` attempts Clerk activation only when the slug resolves to a Gather Space whose Clerk Organization is present in the user's filtered Gather membership list. Otherwise Gather returns to the generic chooser without revealing whether the Space or a same-named other-product Organization exists.

## 6. Webhook and reconciliation filtering

The Clerk webhook endpoint receives events from the shared application instance. It must verify the signature first and then apply these rules:

- Organization create/update: process only events carrying `GATHER_ORGANIZATION_MARKER`.
- Organization delete: process only when its Clerk ID already maps to a Gather Space; deleted payload metadata is not required.
- Membership create/update: process immediately for a known Gather Space. For an unknown Organization ID, fetch the Organization through Clerk Backend and proceed only if it has the Gather marker.
- Membership delete: process only when the Clerk membership or Organization ID maps to Gather projection data.
- User create/update: update a Gather user projection only when that Clerk user already has a Gather membership projection. Other shared users are ignored.
- Invitation events: process or display only invitations carrying `GATHER_INVITATION_MARKER`.

Ignored events return HTTP 200 and perform no writes. This prevents Clerk retries without importing other products' data.

Admin reconciliation first resolves a known Gather Space, then fetches exactly that Organization and its complete membership list. It cannot enumerate, import, mutate, or delete unmarked Organizations. Destructive Space actions re-check both the known Space mapping and the current Gather marker before calling Clerk.

## 7. Shared JWT template

Gather's Convex authorization still requires top-level active-Organization claims:

```json
{
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}"
}
```

The Clerk `convex` JWT template may also be used by other webapps. The change is additive only: existing claims, issuer, audience, lifetime, and clock-skew settings are preserved. Before editing the template, list every other app that requests `getToken({ template: 'convex' })`, capture a decoded development token and authenticated smoke test for each, add the two claims, and repeat the tests.

If either claim name already exists with incompatible semantics, or another app's validation fails, implementation stops before deployment and the integration must be redesigned. Gather never interprets an Organization claim as a Space until `clerkOrganizationId` resolves to a known Gather Space.

Clerk maintains active Organization state per browser tab, while its cookie can reflect the currently focused tab. Gather's Convex bridge must request a fresh token for the active tab and use it as the Authorization bearer token; background Space operations must not authorize from a bare shared cookie.

## 8. Failure and recovery additions

- **Other-product Organization is active:** Gather shows onboarding or activates a filtered Gather Space. It never provisions the active other-product Organization.
- **Gather creation is retried:** the UUID-derived Clerk slug recovers the same marked Organization and resumes Convex projection.
- **Marker is missing or malformed:** Gather ignores the Organization. It does not offer a claim/repair button that could take ownership of another product's data.
- **Webhook receives unrelated events:** it acknowledges them with no writes.
- **Known Gather marker is removed externally:** existing Space access is suspended from admin/destructive operations; reconciliation reports a marker mismatch instead of silently retagging it.
- **JWT compatibility check fails:** no shared template or production configuration is changed.

## 9. Testing additions

Pure tests cover strict metadata-marker recognition, including wrong kind, wrong schema version, missing marker, and extra unrelated metadata.

Convex and webhook tests cover:

- tagged Organization provisioning;
- untagged Organization create/update ignored;
- known tagged Organization deletion cleaned up;
- unknown Organization deletion ignored;
- membership event for a known Gather Space;
- membership event for an unknown untagged Organization ignored after lookup;
- user update ignored without Gather membership;
- idempotent create retry using the same request ID;
- a different user unable to reuse another user's deterministic Clerk slug;
- `ensureMembershipProjection` unable to claim an unknown Organization; and
- destructive/reconciliation actions rejecting marker mismatch.

Component tests cover:

- other-product memberships omitted from Gather onboarding and switcher;
- other-product invitations omitted;
- a user with only other-product memberships seeing Gather create-or-join;
- active other-product Organization never being auto-provisioned; and
- inaccessible or unmarked URL contexts returning to the generic chooser.

Manual compatibility testing covers every known consumer of the shared `convex` JWT template before and after the additive claim change.

## 10. Rollout amendments

Before enabling Gather Spaces in any shared Clerk environment:

1. inventory webapps using the Clerk application, its Organization APIs, and its `convex` JWT template;
2. enable Organizations as membership optional;
3. retain Personal Accounts and disable automatic first-Organization creation;
4. leave the shared role catalog unchanged;
5. add only the two JWT claims after development compatibility tests pass;
6. deploy Gather marker filtering before registering or enabling Organization webhook events;
7. create a tagged test Space and an untagged control Organization;
8. verify Gather imports only the tagged Space;
9. verify every other webapp still signs in and completes its authenticated smoke path; and
10. review shared Organization usage/MRO implications before production rollout.

The base design's two-user/two-Space acceptance matrix still applies, with one additional other-product Organization and invitation as negative controls.

## 11. Success criteria additions

The amendment succeeds when:

- enabling Gather Spaces does not force Organization membership in another webapp;
- Gather never lists, projects, mutates, or deletes an unmarked other-product Organization;
- Gather Organizations and invitations are marked at backend creation time;
- retrying Space creation cannot create a duplicate Clerk Organization;
- role and JWT changes do not alter existing behavior in another webapp; and
- the entire original Space design remains functional for marked Gather Organizations.
