---
type: contract
description: Read when adding a nested web route, breadcrumbs, a back link, or a Module's web address.
version: 1.0.0
status: current
---

# Web navigation

The shell keeps global navigation; a page owns its local hierarchy, because
the page is the only thing that knows which food this is
([ADR-0013](../adr/0013-a-nested-page-carries-its-own-trail.md)). The phone has
no breadcrumbs ([mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#chrome)).

## Behavior

- **Every route below a Module's index renders `<Breadcrumbs>`**
  (`src/components/app/Breadcrumbs.tsx`) with the trail from that index down to
  itself — Foods → *Hagelslag* → Edit, and the same for Recipes and the Baby log.
  **A new nested route gets its trail in the same change.** Nothing enforces
  this: a page without one renders perfectly well, and can be entered but not
  left.
- **A `Crumb`'s `label` is already in the reader's language.** Half a trail is
  content (a food's name, a recipe's title), never translated
  ([ADR-0011](../adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)),
  so the page resolves the words and `Breadcrumbs` never reads a message tree.
- **Back points at the parent's address, never `history.back()`.** Build the
  link with `src/lib/groupPaths.ts` so the Group travels with it; where somebody
  came from is not the collection the page belongs to.
- **The page you are on is the one step with no `link`**, which renders it as
  `aria-current="page"` rather than a link to itself.
- Collection indexes get no trail, nor do flat shell pages (Settings, Account,
  Groups): the shell already names them, and a one-step trail says nothing.
- Every Module is reachable inside a Group: its surface in `groupPaths.ts` and
  its route file are asserted by `src/lib/modules.routes.test.ts`.

## Acceptance

- Each nested page shows a trail whose last step is unlinked and whose parent
  link keeps the current Group.
