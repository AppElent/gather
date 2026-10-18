---
type: contract
description: Read when adding a nested web route, breadcrumbs, a back link, or a Module's web address.
version: 1.1.0
status: current
---

# Web navigation

The shell keeps global navigation; a page owns its local hierarchy, because
the page is the only thing that knows which food this is
([ADR-0013](../adr/0013-a-nested-page-carries-its-own-trail.md)). The phone has
no breadcrumbs ([mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#chrome)).

## Behavior

The [nested-page trail rules](../standards/web-design.md#nested-pages-carry-their-own-trail)
apply as written. Gather binds them:

- **Every route below a Module's index renders `<Breadcrumbs>`**
  (`src/components/app/Breadcrumbs.tsx`) with the trail from that index down to
  itself — Foods → *Hagelslag* → Edit, and the same for Recipes and the Baby log.
- **Content labels** (a food's name, a recipe's title) are never translated
  ([ADR-0011](../adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)).
- **The parent link is built with `src/lib/groupPaths.ts`**, so the Group
  travels with it ([ADR-0002](../adr/0002-the-group-is-explicit-in-the-url.md)).
- The flat shell pages without a trail are Settings, Account and Groups.
- Every Module is reachable inside a Group: its surface in `groupPaths.ts` and
  its route file are asserted by `src/lib/modules.routes.test.ts`.

## Acceptance

- Each nested page shows a trail whose last step is unlinked and whose parent
  link keeps the current Group.
