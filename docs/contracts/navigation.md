---
type: contract
description: Read when adding a nested web route, breadcrumbs, a back link, or a Module's web address.
version: 1.2.0
status: current
---

# Web navigation

The shell keeps global navigation; a page owns its local hierarchy, because
the page is the only thing that knows which food this is
([ADR-0036](../adr/0036-a-nested-page-carries-its-own-trail.md)). The phone has
no breadcrumbs ([mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#chrome)).

## Behavior

The [nested-page trail rules](../standards/web-design.md#nested-pages-carry-their-own-trail)
apply as written. Gather binds them:

- **Every route below a Module's index renders `<Breadcrumbs>`**
  (`src/components/app/Breadcrumbs.tsx`) with the trail from that index down to
  itself — Foods → *Hagelslag* → Edit, and the same for Recipes and the Baby log.
- **Content labels** (a food's name, a recipe's title) are never translated
  ([ADR-0011](../adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)).
- **Every in-app link is built with `linkTo` or `hrefTo` from `src/lib/links.ts`**,
  whose `ROUTES` table names each destination once and is type-checked against
  the route tree. A link never names a Group: the Current Group is ambient
  ([ADR-0031](../adr/0031-the-current-group-is-ambient-on-web-and-mobile.md)),
  and pages read it with `useRequiredCurrentGroup()` rather than receiving it.
- **Switching Group is `setCurrentGroup`, never a link.** A control that moves
  somebody into another Group calls `setCurrentGroup` in its click handler and
  links to a page without params (an index surface), because an id means
  nothing in the other Group.
- The flat shell pages without a trail are Settings, Account and Groups.
- Every Module has one address: `MODULE_ROUTES` in `links.ts` is a
  `Record<ModuleId, …>`, so a Module without one is a type error, and
  `src/lib/modules.routes.test.ts` asserts its route file exists.

## Acceptance

- Each nested page shows a trail whose last step is unlinked and whose parent
  link is its parent's address.
