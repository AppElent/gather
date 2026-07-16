# Gather Command Center Redesign

**Date:** 2026-07-15
**Status:** Approved for implementation planning
**Scope:** Authenticated app redesign: app shell, command-center dashboard, responsive navigation, persistent Gather entry point, module placeholders, and visual system. Real chat persistence and AI automation are out of scope.

## 1. Context

Gather is currently a household-management app with a grouped sidebar, dashboard cards, one live module (Recipes), and several placeholder modules. The attached design files point to a broader product direction: Gather should feel like a command center for a shared group, with coordination, module summaries, and contextual actions organized in one operational UI.

The redesign treats **groups** as the durable product concept. A group may be a household, couple, family, shared home, club, trip, tasting group, or any other small coordinated unit. "Household" can remain a warm default in copy where it fits, but the interface should not hard-code the product around households only.

## 2. Product Direction

Gather becomes a **group command center**. The authenticated home route should open on a command-center surface for the active group. It should visually follow the attached comps: quiet system UI, compact density, crisp borders, 8px radii, neutral low-chroma surfaces, restrained accent color, and operational cards.

The central command surface is not real chat yet. For this redesign it is a **feed-style coordination surface** made from designed or registry-derived blocks:

- recent or sample activity,
- upcoming items,
- module summaries,
- suggested actions,
- and Gather/system-style summaries.

The feed should feel like it could become conversational later, but the first implementation must not create a chat/message backend or imply that automated actions already work.

## 3. Responsive Layout

The app shell should support three responsive modes.

### Desktop

Desktop uses a three-pane layout:

- **Left sidebar:** brand, active group, primary areas, module navigation, group card, and settings/groups access.
- **Center pane:** route content. On `/dashboard`, this is the command feed. On module pages, it is the module page.
- **Right inspector:** group overview cards such as modules/extensions, tasks today, upcoming calendar, and members.

### Tablet

Tablet keeps the command-center feel while reducing chrome:

- sidebar compacts to icons or becomes a drawer, depending on available width,
- right inspector collapses into a toggleable panel or moves below the main content,
- center route content remains primary.

### Mobile

Mobile is a first-class layout, not a squeezed desktop:

- no permanent sidebar or inspector,
- topbar shows active group and current route,
- bottom dock provides stable navigation targets,
- a drawer/sheet exposes full navigation,
- inspector content becomes stacked "Today" cards on the home screen,
- the persistent Gather entry point opens as a sheet or full-height drawer.

The mobile bottom dock should use four stable targets: Home, Tasks, Calendar, and Modules. Routes that do not yet have live modules may still point to their placeholder pages.

## 4. Navigation Model

The redesigned shell shifts navigation from "all modules only" to "active group plus command areas."

Desktop sidebar structure:

1. Brand row: Gather, active group name, and a create/add icon button.
2. Primary areas: Command Center, Tasks, Calendar, Modules.
3. Module groups from the existing registry: Kitchen, Money, Home & life, Tasting.
4. Bottom group card: active group, member initials, sync/share status, and a link to groups/settings.

The existing `MODULES` registry remains the source of truth for module routes, labels, icons, groups, statuses, and descriptions. Sidebar, module cards, command palette, mobile drawer, and placeholder pages should all derive from it where possible.

The topbar becomes contextual:

- route title,
- route subtitle,
- search/command trigger,
- issue report trigger,
- persistent Gather entry point,
- and account menu.

## 5. Persistent Gather Entry Point

Gather should be callable from anywhere in the authenticated app.

On the command-center home route, the central feed is the full expression of this idea. On content pages such as Recipes, Groups, Settings, and future modules, Gather appears as a compact topbar icon button.

Desktop behavior:

- topbar includes an icon button labeled for accessibility as "Ask Gather",
- activation opens a right-side panel or modal,
- the panel is scoped to the active group,
- the panel initially shows a prompt box, examples, and contextual suggestions,
- suggestions must be written as non-automated prompts unless the action is actually implemented.

Mobile behavior:

- the Gather entry point remains reachable from the topbar or dock depending on route density,
- activation opens a bottom sheet or full-height drawer,
- the panel must not obscure persistent save actions, destructive actions, or bottom navigation without an obvious close path.

Implementation boundary:

- build open/close behavior,
- build responsive panel presentation,
- build designed empty and suggestion states,
- do not persist messages,
- do not add AI execution,
- do not add Convex message tables.

Labels should stay product-neutral and future-compatible: prefer "Ask Gather", "Gather", or "Command" over labeling the feature as "AI" everywhere.

## 6. Core Components

The redesign should introduce focused shell components instead of styling each route independently.

- `AppShell`: owns responsive layout, sidebar, topbar, inspector slot, mobile dock, navigation drawer, and route content area.
- `Sidebar`: renders brand, active group identity, primary areas, registry module groups, settings, and groups links.
- `Topbar`: renders contextual title/subtitle, command/search trigger, issue reporter, Gather entry point, and account menu.
- `GroupInspector`: renders the desktop right column and provides content that can be reused as mobile "Today" cards.
- `MobileDock`: renders Home, Tasks, Calendar, and Modules with route-aware active states.
- `GatherPanel`: renders the persistent callable Gather panel with placeholder prompts and responsive presentation.
- `CommandFeed`: renders the dashboard command-center feed and activity cards.
- Shared primitives: `IconButton`, `SurfaceCard`, `Pill`, `AvatarStack`, `StatusDot`, and `SectionHeader`.

These components should remain presentational unless they already have real app data to read. Keep behavior close to the shell and route components; do not introduce a broad state-management abstraction for this redesign.

## 7. Data Approach

Reuse existing data and registries:

- `MODULES` and `modulesByGroup()` drive module navigation and module/extension cards.
- existing auth state drives signed-in layout access and account display.
- existing group data can be used where available.
- presentational fallbacks are acceptable while group/member/task/calendar data is incomplete.

The redesign should avoid Convex schema changes unless a tiny read helper is needed for existing data display. Do not create message, assistant, task, or calendar schemas as part of this work.

## 8. Visual System

The authenticated app should move away from the current decorative gradients, island cards, and Fraunces/Manrope look. The new shell should use the design files as a north star:

- system-style font stack,
- low-chroma near-white background,
- neutral foreground and muted text colors,
- one restrained accent color,
- crisp 1px borders,
- 8px border radius for app UI,
- compact spacing,
- stable icon buttons with lucide icons,
- dense but readable cards and rows.

Public and auth pages can remain compatible with `@appelent/auth` and do not need the full command-center shell. If theme tokens are adjusted, keep auth screens visually coherent without making them the focus of this redesign.

## 9. Route Behavior And States

Loading states:

- the authenticated loading state should be restyled to match the new shell tone.
- list skeletons should use neutral surfaces and borders.

Dashboard:

- `/dashboard` becomes the command-center home.
- central feed uses designed activity/system cards.
- right inspector appears on desktop and collapses into home cards on mobile.

Module pages:

- live modules, beginning with Recipes, render inside the redesigned shell.
- module placeholders become operational placeholder pages, not centered "coming soon" islands.
- empty module states should use real module layout patterns with clear actions.

Gather panel:

- empty state makes clear that automation is coming later.
- examples must not overpromise working automation.
- Escape and close controls should dismiss the panel.

Mobile drawer and dock:

- drawer supports open/close state and Escape/overlay dismissal.
- dock highlights active route families.
- bottom navigation must not overlap route actions or form submission buttons.

## 10. Testing

Keep existing tests passing and update expectations for the redesigned shell.

Expected coverage:

- registry integrity still verifies module paths resolve,
- shell navigation renders expected desktop labels,
- mobile dock renders Home, Tasks, Calendar, and Modules targets,
- persistent Gather entry point renders and opens/closes the panel,
- module placeholders render from registry data in the new layout,
- existing recipe form and issue reporter tests continue to pass.

Verification commands after implementation:

```sh
pnpm run check
pnpm run typecheck
pnpm test
pnpm run build
```

Focused tests may be run during development, but final verification should include the broader commands unless a known unrelated blocker is documented.

## 11. Out Of Scope

This redesign does not include:

- real chat persistence,
- AI action execution,
- Convex message tables,
- full implementations of Tasks, Calendar, Groceries, Pantry, Finances, Bills, Notes, Cheeses, or Wines,
- complete multi-group switching UI,
- notification workflows,
- calendar integrations,
- rebuilding public/auth pages beyond token compatibility,
- or replacing the existing group/sharing model.

## 12. Success Criteria

The redesign is successful when:

- Gather feels like a group command center rather than a module launcher,
- the attached design files are clearly reflected in the authenticated app,
- desktop, tablet, and mobile each have intentional navigation,
- the persistent Gather entry point is available from content pages,
- current live functionality, especially Recipes, remains usable,
- placeholder modules feel integrated and operational,
- and the implementation leaves a clear path to real chat or AI later without building those systems now.
