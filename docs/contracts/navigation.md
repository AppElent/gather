---
type: contract
description: Read when adding a nested web route, breadcrumbs, a back link, or a Module's web address.
version: 2.0.0
status: current
---

# Web navigation

The shell keeps global navigation; a page owns its local hierarchy, because
the page is the only thing that knows which recipe this is
([ADR-0036](../adr/0036-a-nested-page-carries-its-own-trail.md)). The phone has
no breadcrumbs ([mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#chrome)).

## Behavior

The [nested-page trail rules](../standards/web-design.md#nested-pages-carry-their-own-trail)
apply as written. Gather binds them:

- **Every route below an index renders `<Breadcrumbs>`**
  (`src/components/app/Breadcrumbs.tsx`) with the trail from that index down to
  itself — Recipes → *Stamppot* → Edit, and the same for the Baby log and the
  tasting Modules. `Breadcrumbs.routes.test.ts` walks `src/routes/_app/` for it.
  The one exception is the OAuth callback.
- **Content labels** (a recipe's title, a cheese's name) are never translated
  ([ADR-0011](../adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)).
- **Every link to a page in the signed-in app is built with `linkTo` or
  `hrefTo` from `src/lib/links.ts`**, whose `ROUTES` table names each such
  destination once and is type-checked against the route tree. Three kinds of
  address are not in `ROUTES`, and the few places that reach them write the
  path: the landing address `/`, which only decides where to send you; the
  sign-in, sign-up and forgot-password pages; and the OAuth callback, which only
  a provider sends anyone to. A link never names a Group: the Current Group is
  ambient ([ADR-0031](../adr/0031-the-current-group-is-ambient-on-web-and-mobile.md)),
  and pages read it with `useRequiredCurrentGroup()` rather than receiving it.
  `AppShell` renders a page under a Group index surface only once there is a
  Current Group: it shows loading until the Groups arrive and sends somebody in
  no Group to Groups.
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
