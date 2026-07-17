# Space-Centered Gather Plan Audit

This audit is a mandatory companion to `2026-07-17-space-centered-gather.md`. It records the corrections found during the required spec-coverage and type-consistency review. Where wording differs, this file is authoritative.

## Corrections to Task 3

- The exact auth exports are `requireUser(ctx)`, `readSpaceClaims(identity, requireAdmin?)`, `requireActionSpaceClaims(ctx, requireAdmin?)`, and `requireActiveSpace(ctx, { spaceSlug, requireAdmin? })`.
- `requireActionSpaceClaims` reads the action's signed identity and normalizes the same top-level `org_id` and `org_role` claims as `readSpaceClaims`; Task 6 must not introduce a second claim parser.

## Corrections to Task 4

- `spaces.ensureActive` must upsert the current user's membership projection on both its create and existing-Space paths. This lets a signed member repair a delayed membership webhook projection without becoming an admin or creating a second organization.
- New Spaces must not initialize empty navigation/dashboard defaults. `createNewSpaceDefaults()` persists ordered Tasks, Notes, and Calendar pin references and deterministic instances for each module's `defaultWidgetIds`, such as `instanceId: "default:calendar.upcoming"`.
- Effective selectors suppress references whose modules are not live. Stored defaults retain them so pre-enabled modules surface in their intended positions when the registry changes to `live`.

The existing-Space branch is:

```ts
const user = await requireUser(ctx);
const now = Date.now();
if (existing) {
  await upsertMembershipProjection(ctx, {
    spaceId: existing._id,
    userId: user._id,
    clerkUserId: identity.subject,
    role: claims.role,
    now,
  });
  return { spaceId: existing._id, slug: existing.slug };
}
```

The create branch uses:

```ts
const defaults = createNewSpaceDefaults();
const spaceId = await ctx.db.insert("spaces", {
  clerkOrganizationId: claims.clerkOrganizationId,
  slug,
  name,
  status: "active",
  defaultPinnedModuleIds: defaults.pinnedModuleIds,
  defaultDashboard: defaults.dashboard,
  createdAt: now,
  updatedAt: now,
});
```

## Corrections to Tasks 5 and 6

- An `organization.deleted` webhook runs the same idempotent Space-owned cleanup/finalization path as admin deletion, even if the Space was not already marked `deleting`. It must not merely delete the Space row and strand domain records.
- Space deletion performs: mark `deleting` → atomic Convex domain/configuration cleanup while retaining the deleting Space marker → delete Clerk Organization → idempotently finalize the Space record. A retry resumes from the first incomplete phase.
- Every privileged-action authorization error caused by a fresh role change is surfaced in the client as “Your Space role changed”, followed by a Space-context refresh.

## Corrections to Task 7

- `preEnabled` is allowed only for the default Tasks, Notes, and Calendar intentions. Admins cannot pre-enable arbitrary coming-soon modules in version one.
- Archiving suppresses module pins and widget instances from effective selectors but does not remove them from Space defaults or personal snapshots.
- Snapshot validation rejects unknown IDs and invalid widget shape/size/multiplicity/configuration, but it retains known archived and pre-enabled references at their stored positions.
- Permanent deletion sets `deletionStatus: "pending"`, then calls one internal atomic mutation that:
  1. runs the module's registered domain cleanup;
  2. removes that module ID from the Space default pins;
  3. removes its widgets from the Space default dashboard;
  4. removes its pins/widgets from every personal snapshot in that Space; and
  5. removes the `spaceModules` row.
- If the atomic cleanup throws, no references or domain records are partially removed. A follow-up mutation sets `deletionStatus: "failed"`; the module stays archived and retryable.

## Corrections to Task 8

- `SpaceRouteGate` must attempt activation only when the requested Gather slug maps to an organization in the signed-in user's Clerk membership list.
- A missing or inaccessible slug returns to a generic “Choose a Space” state. It must not show a differentiated 404 that confirms whether another user's Space exists.
- The gate states are: loading memberships, choosing a Space, activating Clerk organization, waiting for the refreshed Convex token, loading authorized context, and ready.

## Corrections to Task 11

- Coming-soon entries are disabled admin-catalog rows. Only Tasks, Notes, and Calendar may display their silently pre-enabled status. Arbitrary coming-soon modules have no opt-in control.
- Navigation editors expose visible modules for add/remove/reorder but merge the edited visible projection back into the stored snapshot while preserving suppressed archived/pre-enabled IDs at their existing anchors.
- Dialogs and drawers used for invitations, destructive deletion, and configuration must trap focus, close on Escape, restore focus to their trigger, have accessible names, and be fully keyboard operable.

## Corrections to Task 12

- Personal and admin dashboard editors retain suppressed archived/pre-enabled widget instances at their saved anchors while visible instances are edited. Saving cannot erase temporarily unavailable placements.
- A coming-soon module or one without a renderer remains absent from the Add library and normal rendering, but its recommended default references remain stored.
- Home's empty state is calm and role-specific: admins can manage modules or the Space default dashboard; members can add widgets from enabled modules; suppressed coming-soon defaults are not advertised as broken content.

## Additional Acceptance Assertions for Task 13

Add these assertions to the end-to-end matrix:

1. Archive a pinned module with placed widgets, save an unrelated navigation/dashboard change, restore the module, and verify its pins/widgets return at their previous positions.
2. Permanently delete that module and verify its references are removed from the Space default and all personal snapshots, while the same module in another Space is untouched.
3. Delay a membership webhook, enter through onboarding with a valid active organization claim, and verify `ensureActive` repairs the current user's projection.
4. Request a slug that is absent from the user's Clerk organization list and verify the UI returns to the chooser without revealing whether the Space exists.
5. Change an admin to member in a second session, attempt a stale privileged action in the first session, and verify the role-changed message plus refreshed controls.

## Review Result

- Spec coverage: all 19 design-spec sections map to Tasks 1–13 plus the corrections above.
- Placeholder scan: no implementation placeholders are accepted; any merged parallel module is integrated by its actual exported contract at execution time.
- Type consistency: the authoritative shared names are the contracts in the base plan plus the corrected auth helper list above.
