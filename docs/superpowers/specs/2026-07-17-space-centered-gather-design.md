# Space-Centered Gather Design

**Date:** 2026-07-17  
**Status:** Approved conversational design; awaiting written-spec review  
**Scope:** Replace the current all-modules command center with Clerk-backed Spaces, Space-scoped modules and navigation, and configurable Space dashboards.

## 1. Context

Gather currently presents every planned module in several places at once. The desktop sidebar renders four primary areas and all eleven modules, the dashboard repeats the complete module catalog, mobile has a fixed set of module-oriented destinations, and a permanent right inspector repeats group summary information. Most modules are placeholders, and the shell still uses hard-coded “Preview group” data even though Convex already has groups, memberships, invite codes, and owner/member roles.

This makes the interface look busier and more complete than the product really is. It also assumes every collaboration context needs the same modules. A household may need Tasks, Notes, Calendar, meal planning, and groceries; a wine club may need Wines and Calendar; another Space may use only one specialized module.

The redesign makes the collaboration context the starting point. It separates:

1. which modules a Space uses,
2. which of those modules an individual member pins in navigation, and
3. which widgets appear on the shared-default or personal dashboard.

The result should feel calm when a Space uses only a few modules while keeping every enabled capability discoverable.

## 2. Goals

The redesign must:

- establish **Space** as the product name and top-level owning context;
- use Clerk Organizations for Space membership, invitations, active selection, and roles;
- scope operational records to exactly one Space;
- keep genuinely global reference data outside Spaces;
- let administrators enable, archive, restore, and permanently remove modules;
- let administrators define default navigation and dashboard layouts;
- let individual members customize navigation and dashboards without changing other members’ views;
- keep every enabled module reachable even when it is not pinned;
- hide unfinished modules from ordinary navigation and dashboards;
- remove duplicated shell surfaces and placeholder-driven visual noise;
- work intentionally on desktop and mobile;
- preserve a contained exit path if Clerk Organizations becomes unsuitable later; and
- integrate with, rather than duplicate, the Tasks, Notes, Calendar, nutrition, and provider work being developed in parallel.

## 3. Non-goals

This project does not implement:

- the domain behavior or provider architecture for Tasks, Notes, or Calendar;
- nutrition data or nutrition logging;
- a free-position, pixel-based dashboard grid;
- public share links or “duplicate into my Space” flows;
- cross-Space live sharing of records;
- production migration of the existing group data;
- custom role builders or fine-grained per-module permissions;
- external calendar, notes, or task providers;
- module billing, entitlements, or plan-based feature gates; or
- AI/chat behavior in the dashboard.

## 4. Product terminology and ownership model

### 4.1 Space

A **Space** is the persistent collaboration container. It owns:

- its name and stable URL slug;
- its Clerk Organization mapping;
- its members and their `admin` or `member` roles;
- its enabled, pre-enabled, and archived modules;
- its default navigation pins;
- its default dashboard layout;
- member-specific navigation and dashboard snapshots; and
- operational data created in the Space.

“Group” is no longer used as the product term. It may appear only in historical migrations or low-level comments while old code is being removed.

### 4.2 One owning Space per operational record

Every operational domain record belongs to exactly one internal Convex `spaceId`. A recipe, task, note, event, wine rating, or meal log cannot be live-linked to several Spaces.

Records also retain creator/editor attribution separately, for example `createdByUserId`. Attribution does not grant private ownership over shared Space data; authorization comes from current Space membership and the module’s rules.

This replaces the current `ownerId + sharedGroupIds[]` model for Space-owned data.

### 4.3 Global reference data

Truly universal reference data can omit `spaceId`. Nutrition reference data is the motivating example: every Space may read the same food/nutrient definitions while each Space’s meal logs remain Space-owned.

Global tables must define their own write authority. Omitting `spaceId` never means unauthenticated clients may mutate the data.

### 4.4 Future public sharing

Future public sharing is a publication boundary, not a relationship between Spaces. A public recipe will be read-only. An authenticated viewer may duplicate it into one target Space, producing a new independently owned record with no ongoing link to the source.

No public-share table, route, token, or duplication action is built in this project. The one-Space ownership model must not preclude adding that feature later.

## 5. Clerk Organizations boundary

### 5.1 Responsibilities

Clerk is authoritative for:

- Organization creation and deletion;
- Organization membership;
- email invitations and invitation acceptance;
- the active Organization in a browser tab;
- the `admin` and `member` roles; and
- signed session claims used to prove the active Organization and role.

Convex is authoritative for:

- the internal Space ID;
- Gather’s display/configuration projection of the Space;
- the stable Gather URL slug;
- module configuration;
- navigation and dashboard preferences;
- module data; and
- a synchronized membership projection used for member lists, auditing, and portability.

### 5.2 Roles

Version one supports exactly two roles:

| Capability | Admin | Member |
|---|---:|---:|
| View and use enabled modules | Yes | Yes |
| Customize own pins/dashboard | Yes | Yes |
| Invite members | Yes | No |
| Revoke invitations | Yes | No |
| Change member roles | Yes | No |
| Remove members | Yes | No |
| Rename the Space | Yes | No |
| Manage Space-default pins | Yes | No |
| Manage Space-default dashboard | Yes | No |
| Enable/archive/restore modules | Yes | No |
| Permanently delete module data | Yes | No |
| Delete the Space | Yes | No |

Multiple admins are allowed. The application must prevent leaving, removing, or demoting the last admin. Space deletion is a separate destructive flow and must not be reachable through ordinary member removal.

### 5.3 Portability boundary

No operational record stores a Clerk Organization ID. Only the Space integration layer maps `clerkOrganizationId` to the internal `spaceId`.

Clerk-specific claim decoding, Organization APIs, switching, webhooks, and reconciliation live behind focused adapters. UI components consume Gather `Space`, `SpaceMembership`, and `SpaceRole` values rather than raw Clerk Organization objects wherever practical.

If Clerk Organizations must be replaced later, the migration is limited to account membership, invitations, role assignment, session selection, and integration adapters. Space configuration and domain data remain intact.

## 6. Space lifecycle and onboarding

### 6.1 Signed-in user with no Space

Personal-account sign-in remains possible so a user can authenticate before belonging to an Organization. A signed-in user with no accessible Space is routed to a focused onboarding screen with two paths:

- **Create a Space:** enter a name, create the Clerk Organization, set it active, create the Convex Space projection, and enter Space Home.
- **Join a Space:** accept a Clerk invitation. Invite codes from the current Convex group model are removed.

Gather does not automatically create a one-member “Home” Space.

### 6.2 Creation defaults

A new Space receives:

- a Gather-managed immutable slug derived from its initial name and made globally unique with a deterministic suffix when necessary;
- the creator as `admin`;
- Home, Members, All modules, and Space settings as built-in surfaces;
- Tasks, Notes, and Calendar as default module intentions; and
- recommended default pin and widget references for those three modules.

If a default module is already live, its Space state is `enabled`. If it is still unfinished, its state is `preEnabled`: it remains invisible until the registry marks it live, at which point it becomes effectively enabled without requiring an administrator to revisit setup.

Recipes is live and available in the catalog but is not automatically enabled for every new Space because it is not relevant to every Space type.

### 6.3 Naming and slug behavior

Admins may rename a Space. Renaming does not change its Gather slug, so existing links remain valid. Slug editing and redirect history are deliberately omitted from version one.

### 6.4 Space deletion

Deleting a Space requires an admin, explicit confirmation using the Space name, and a fresh authorization check. The operation deletes Space-owned configuration and domain data, then deletes the Clerk Organization. Partial failure must be retryable and idempotent; the UI must never report completion while either side still exists.

## 7. Active Space, URLs, and routing

Authenticated Space content uses explicit routes:

```text
/s/:spaceSlug/home
/s/:spaceSlug/modules
/s/:spaceSlug/members
/s/:spaceSlug/settings
/s/:spaceSlug/:modulePathSegment/...
```

The URL Space and Clerk’s active Organization must agree before Space data loads.

- Selecting a Space calls Clerk `setActive`, waits for the refreshed token to reach Convex, and then navigates to `/s/:spaceSlug/home`.
- Opening a valid URL for another accessible Space activates that Organization before rendering its data.
- Opening an inaccessible or unknown slug shows the Space chooser without revealing whether the Space exists.
- While activation/token refresh is pending, the app shows a Space-switching state rather than briefly querying the prior Space.

Legacy authenticated paths such as `/dashboard` and `/recipes` redirect to the corresponding active-Space route. If no Space is active or accessible, they redirect to onboarding. Legacy routes do not retain independent content implementations.

Clerk’s per-tab active Organization behavior is acceptable and intentional: two tabs may display different Spaces because each URL also makes the context explicit.

## 8. Authorization and synchronization

### 8.1 Authorization helper

One shared Convex helper must:

1. require a signed-in Clerk identity;
2. decode the active Organization ID and role from the signed claim;
3. resolve the Organization ID to an internal Space;
4. verify any requested slug/Space matches the active claim;
5. return the Gather user, Space, membership projection, and role; and
6. enforce `admin` for privileged operations when requested.

Every public Space-scoped Convex query, mutation, and action uses this helper. Client-supplied `spaceId`, slug, user ID, or role is never sufficient authorization.

### 8.2 Membership projection

Verified Clerk webhook events synchronize Organization, membership, user, and role changes into Convex. Handlers are idempotent and tolerate duplicate or out-of-order delivery.

The projection supports member UI, auditing, and a Clerk exit path, but it is not the final security authority. A removed member cannot retain access merely because a webhook is delayed: Space access uses the current signed Organization claim.

### 8.3 Reconciliation

An admin-only reconciliation action reads the Organization and complete membership list from Clerk’s Backend API and repairs the Convex projection. It is used after a failed webhook, incomplete creation flow, or detected mismatch.

Creation, webhook, and reconciliation operations upsert by immutable Clerk IDs so retries cannot create duplicate Spaces or memberships.

## 9. Module catalog and Space module states

### 9.1 Code-level module definition

The static registry remains the source of truth for capabilities shipped in the application bundle. A module definition includes:

```ts
type ModuleAvailability = 'live' | 'comingSoon'

interface ModuleDefinition {
  id: string
  label: string
  description: string
  icon: string
  pathSegment: string
  availability: ModuleAvailability
  defaultForNewSpaces: boolean
  widgets: WidgetDefinition[]
}
```

IDs and path segments are stable once released. User-facing labels and descriptions may change.

The provider model being built for Tasks, Notes, and Calendar remains module-owned. This shell consumes those module definitions and does not implement or reinterpret provider configuration.

### 9.2 Space module state

A Space module record uses:

```ts
type SpaceModuleState = 'preEnabled' | 'enabled' | 'archived'
```

No record means the module is disabled for that Space.

- `preEnabled`: selected in advance but invisible while `comingSoon`; effectively enabled as soon as the code registry becomes `live`.
- `enabled`: visible and usable because the code registry is `live`.
- `archived`: hidden and unusable, but data, pins, widget placements, and provider configuration are retained.

Only admins change Space module state.

### 9.3 Catalog visibility

Ordinary members see only live modules enabled for their Space. Coming-soon modules do not appear in the sidebar, mobile navigation, All modules, command search, dashboard, or route suggestions.

Admins see Space settings split into:

- **Enabled modules**;
- **Available modules** that are live but disabled; and
- **Coming soon**, displayed as disabled catalog entries without navigable placeholder pages.

Only the default Tasks, Notes, and Calendar intentions are silently pre-enabled. Admins cannot opt arbitrary coming-soon modules into automatic activation in version one.

### 9.4 Archive, restore, and deletion

Archiving a module:

- removes it from effective navigation, search, routes, and widget rendering;
- preserves module data and provider configuration;
- preserves default and personal pin/widget references; and
- allows restoration to the exact prior layout positions.

Restoring an archived live module makes it usable immediately. Restoring an archived module that has returned to `comingSoon` is not allowed.

Permanent deletion is a separate admin-only flow with explicit confirmation. It:

- invokes the module’s server-side Space-data deletion contract;
- removes module-owned provider/configuration data;
- removes all default and personal pin/widget references;
- removes the Space module record, leaving the module disabled; and
- does not affect the same module in any other Space.

Removing a widget or unpinning a module never deletes module data.

## 10. Navigation design

### 10.1 Shared and personal navigation

Admins maintain the Space’s ordered default module pins. A member without a personal override follows that default live: later admin changes appear automatically.

The first personal navigation edit stores an independent ordered snapshot. From then on, admin changes do not merge into that member’s pins. **Reset to Space default** deletes the personal snapshot and immediately adopts the latest default.

Unavailable, disabled, or archived module IDs may remain in an underlying snapshot so temporary archival can be reversed, but they are filtered from effective navigation. Permanent module-data deletion removes the references.

### 10.2 Desktop

The desktop sidebar contains, in order:

1. Gather identity and Space switcher;
2. Home;
3. all effective personal/default module pins in their saved order;
4. All modules;
5. Members; and
6. Space settings.

The previous “Today” section, duplicated module categories, preview group card, and permanent right inspector are removed. The sidebar may scroll when a member deliberately pins many modules, but the product does not force every enabled module into it.

### 10.3 Mobile

The bottom navigation contains exactly five positions:

1. Home;
2. first effective pin;
3. second effective pin;
4. third effective pin; and
5. All.

Missing pins leave fewer module destinations rather than introducing arbitrary filler actions. Members and Settings remain reachable from the Space/account controls and All screen.

When the current module is not one of the three visible pins, All receives the active state. Pin ordering determines which three modules receive direct mobile destinations.

### 10.4 All modules screen

`/s/:spaceSlug/modules` is a full route, not a temporary sheet. It provides:

- a search field;
- a compact **Pinned** section containing effective pins not already exposed in the mobile bottom bar;
- a responsive tile grid containing every live, enabled module exactly once;
- **Edit navigation**; and
- an admin-only **Manage modules** action.

Tiles show icon and label. Secondary status or explanatory copy appears only when actionable; the screen does not recreate the current paragraph-heavy module catalog.

Disabled and coming-soon modules never appear here.

### 10.5 Command search and direct URLs

Command search contains Home, enabled modules, Members, and relevant settings for the active Space. Admin-only commands are omitted for members.

A direct URL to a live but disabled module renders “Not enabled for this Space.” Admins receive an enable action; members receive a route back to All modules. The server returns no module data before this state is resolved.

## 11. Dashboard widget system

### 11.1 Home

Space Home becomes a focused widget canvas. It replaces the current designed-preview feed, module-card catalog, suggested actions, and right-hand inspector.

If no effective widgets are available, Home shows a calm empty state:

- admins can manage modules or edit the Space default dashboard;
- members can add widgets from enabled modules that contribute them; and
- coming-soon defaults are not advertised as broken content.

### 11.2 Widget definition and instance

A live module may contribute widget definitions:

```ts
type WidgetSize = 'compact' | 'standard' | 'wide'

interface WidgetDefinition {
  id: string
  moduleId: string
  label: string
  allowedSizes: WidgetSize[]
  defaultSize: WidgetSize
  allowMultiple: boolean
}

interface WidgetInstance {
  instanceId: string
  widgetDefinitionId: string
  size: WidgetSize
  config?: unknown
}
```

Widget IDs are stable. Module-owned configuration is validated by that module; the dashboard does not interpret Calendar, Tasks, Notes, nutrition, or provider-specific fields.

A definition appears once unless `allowMultiple` is explicitly true. The dashboard rejects sizes not listed by the definition.

### 11.3 Space default and member snapshots

Admins edit the Space default from **Space settings → Default dashboard**, not through an ambiguous admin mode on their personal Home.

All members without a personal dashboard override follow the current Space default. The first personal add, remove, reorder, resize, or configuration change stores an independent full snapshot. Later admin changes do not merge into that snapshot.

**Reset to Space default** deletes the personal snapshot. It does not copy the current default into another permanent personal record.

The default layout is initialized with recommended widget references from Tasks, Notes, and Calendar. References for pre-enabled coming-soon modules remain suppressed but retained, including when a member snapshots the layout, so they become visible when the module becomes live.

### 11.4 Layout behavior

Version one stores an ordered list, not x/y coordinates.

- Desktop uses a responsive grid derived from order and `compact`/`standard`/`wide` size.
- Mobile renders a predictable single-column order.
- Editing supports add, remove, reorder, and allowed size changes.
- Keyboard-accessible reorder controls are available in addition to pointer interactions.
- Removing a widget changes layout only.

The ordered model is the migration source for a future free-position drag/resize grid.

### 11.5 Availability and module lifecycle

The Add widget library contains definitions only when their module is live and enabled for the Space.

Archiving a module suppresses its widget instances in Space defaults and personal snapshots without changing their saved positions. Restoring the module restores the widgets. Permanent module-data deletion removes those instances from every affected layout.

### 11.6 Loading and failure isolation

Each widget owns its loading, empty, and domain error presentation. The dashboard supplies the shared frame and an error boundary around each widget.

One failed widget must not blank Home or prevent editing/removing that widget. An unavailable definition renders a removable “Widget unavailable” editor state but remains hidden in normal view mode.

## 12. Data model

The exact validators are implementation-plan material, but the logical tables are fixed:

### `users`

Retains the Gather user projection keyed by Clerk user ID. Removes `defaultGroupId`.

### `spaces`

Stores Clerk Organization ID, immutable Gather slug, display name, default pin order, default widget instances, and lifecycle timestamps. Clerk Organization ID and slug are uniquely indexed.

### `spaceMemberships`

Stores Space ID, Gather user ID, Clerk membership ID, Clerk user ID, and `admin`/`member` role. It is indexed by Space, user, Clerk membership ID, and the `(spaceId, userId)` pair.

### `spaceModules`

Stores Space ID, stable module ID, state, and timestamps. The `(spaceId, moduleId)` pair is unique.

### `spacePreferences`

Stores one row per `(spaceId, userId)`. Optional `pinnedModuleIds` and optional dashboard widget instances represent personal snapshots. An absent field means “inherit Space default”; an empty array is an intentional empty personal layout.

### Domain records

Recipes and later Space-owned records store `spaceId` and creator/editor attribution. The current recipe `sharedGroupIds` field is removed during the development reset.

## 13. Failure and recovery behavior

### 13.1 Organization created but Space projection failed

Onboarding recognizes the active Clerk Organization and retries the idempotent Space upsert. It does not create a second Organization.

### 13.2 Space projection exists but membership webhook is delayed

The active signed claim allows the current user to reconcile/upsert their own membership projection. Full membership lists use reconciliation when necessary.

### 13.3 Role changes during an operation

Every privileged mutation re-checks the current signed role. The UI surfaces “Your Space role changed” and refreshes Space state rather than treating it as a generic network failure.

### 13.4 Organization/Space mismatch

The app attempts activation only for an Organization present in the signed-in user’s Clerk Organization list. Otherwise it shows the chooser without confirming existence.

### 13.5 Webhook failure

Invalid signatures receive a non-success response and perform no writes. Valid duplicate events succeed idempotently. Administrators can run reconciliation after delivery failures.

### 13.6 Module deletion failure

Deletion records progress so retrying resumes safely. The module remains archived/unavailable until every module-owned cleanup and configuration cleanup succeeds. The UI never returns it to a clean disabled state prematurely.

## 14. Responsive and accessibility requirements

- Desktop, drawer, All modules, and mobile bottom navigation use the same effective pin/module selectors.
- Mobile bottom navigation reserves adequate touch targets and never exceeds five items.
- Space switching, navigation editing, dashboard editing, and destructive confirmations are fully keyboard operable.
- Drawers and dialogs preserve focus trapping, Escape handling, focus restoration, and accessible names already tested in the shell.
- Reordering is not pointer-only; move controls expose position changes to assistive technology.
- Color and badges never carry module state without text.
- Bottom navigation does not overlap module forms or persistent actions.
- Loading transitions do not display data from the previously active Space.

## 15. Development reset and compatibility

Existing development data is disposable. The implementation removes:

- `groups` and the current `memberships` schema;
- custom invite codes and join-by-code mutations;
- `users.defaultGroupId`;
- recipe `sharedGroupIds` sharing; and
- hard-coded Preview group shell data.

No dual-read, dual-write, backfill, or production migration code is added. Developers reset the affected Convex deployment and re-enter through create-or-join onboarding.

Legacy URL redirects are retained for bookmark usability, but old group APIs and data shapes are not compatibility surfaces.

## 16. Parallel-session integration contract

Before implementation begins, the merged state of the Tasks, Notes, Calendar, nutrition, and provider work must be inspected.

This project may adapt those modules to the shared `ModuleDefinition` and `WidgetDefinition` contracts, Space route hierarchy, and Space authorization helper. It must not reimplement their data models or provider behavior.

If Tasks, Notes, or Calendar is still `comingSoon` at merge time, its pre-enabled state and widget references remain invisible. The Space redesign remains valid and shippable with an empty or partially populated default dashboard.

## 17. Testing strategy

### 17.1 Pure model tests

Cover:

- registry ID/path/widget uniqueness;
- effective availability for live, coming-soon, pre-enabled, enabled, archived, and absent module records;
- Space-default versus personal pin selection;
- the first three effective mobile pins;
- All modules sections and filtering;
- Space-default versus personal dashboard selection;
- suppressed and restored archived-module widgets;
- validation of widget multiplicity and size; and
- removal of layout references after permanent deletion.

### 17.2 Convex authorization tests

Cover:

- unauthenticated rejection;
- active Organization resolution;
- URL/request Space mismatch;
- cross-Space data isolation;
- admin/member permissions for every privileged operation;
- last-admin protection;
- current signed claims overriding stale projections;
- idempotent Space and membership upserts; and
- module-data deletion affecting only the requested Space.

### 17.3 Webhook and reconciliation tests

Cover:

- signature rejection;
- Organization create/update/delete;
- membership create/update/delete;
- duplicate and out-of-order events;
- missing user/Space dependencies;
- complete reconciliation; and
- safe retry after partial failure.

### 17.4 Component and route tests

Cover:

- create-or-join onboarding;
- Space switching and token-refresh loading;
- inaccessible slug behavior;
- legacy redirects;
- compact desktop navigation;
- five-position mobile navigation;
- active All state for overflow modules;
- All modules search and tile sections;
- admin-only module management;
- archive/restore/delete confirmations;
- disabled-module direct routes;
- navigation snapshot and reset;
- dashboard snapshot and reset;
- widget editing and keyboard reorder; and
- per-widget error isolation.

### 17.5 Regression and final verification

Existing Recipes behavior, auth pages, account/settings integration, issue reporter, command palette accessibility, drawer focus management, and public pages must continue to pass after route and shell updates.

Final verification runs:

```sh
pnpm run check
pnpm run typecheck
pnpm test
pnpm run build
```

## 18. Rollout and configuration

Before enabling the feature in an environment:

1. enable Clerk Organizations and retain Personal Accounts;
2. confirm the creator/default roles are `admin` and `member`;
3. configure the Clerk webhook endpoint and signing secret;
4. configure the Clerk Backend API secret in Convex;
5. deploy Convex auth/schema/functions;
6. reset development data;
7. regenerate route and Convex types;
8. deploy the web application; and
9. verify create, invite, accept, switch, revoke, and reconciliation flows using at least two users and two Spaces.

Production must not be switched to the new schema until its Clerk environment and webhook are configured. This design contains no production data migration.

## 19. Success criteria

The design is successful when:

- a signed-in user starts by creating, joining, or selecting a Space;
- the active Space is explicit in both the URL and shell;
- a Space with one enabled module presents a genuinely minimal interface;
- unfinished modules are absent from ordinary member UI;
- admins can configure modules without changing members’ personal navigation;
- every enabled module remains reachable through All modules and command search;
- desktop shows all chosen pins while mobile exposes Home, three pins, and All;
- admin defaults update members who still inherit them but never overwrite personal snapshots;
- dashboard widgets can be added, removed, reordered, and resized without deleting domain data;
- archived modules disappear and restore with prior layout positions intact;
- permanent module deletion is explicit, Space-scoped, and retryable;
- one widget failure cannot break Space Home;
- no request can read or mutate another Space by supplying a different ID or slug;
- existing live module behavior remains functional inside the Space route hierarchy; and
- replacing Clerk Organizations later would not require rewriting Space-owned domain data.

