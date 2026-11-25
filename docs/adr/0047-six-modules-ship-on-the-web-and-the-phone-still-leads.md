---
type: decision
description: Read before deciding whether tasks, notes, calendar, groceries, the meal planner or shared costs get a web screen, or before porting one of them to the web.
version: 1.0.0
status: accepted
date: 2026-11-18
---

# Six Modules ship on the web too, and the phone still leads

[ADR-0042](0042-the-phone-leads-and-the-web-is-where-a-household-is-managed.md)
made the phone the leading platform and kept daily-capture Modules off the
web: calendar, notes, groceries, the meal planner and shared costs were
`exclusive` to the phone, and their web routes render `ModulePlaceholder`
(`planned-web-modules`). [APP-83](https://linear.app/appelent/issue/APP-83)
kept those placeholders on 12 Nov 2026 until someone decided per Module.

The Gather overhaul (18 Nov 2026) redesigns these Modules. On a decision card
that day Eric chose "Ja, alle zes op web": a household also plans its week,
its shopping and its shared costs at a desk, and a placeholder there reads as
a broken app. This ADR records that choice for six Modules and leaves the rest
of ADR-0042 standing.

## Decision

**Six Modules ship on both platforms**: tasks, notes, calendar, groceries, the
meal planner and shared costs. Each gets a full web version with the same data
and actions as the phone, not a read-only view. Tasks is already on both
platforms (`parity`); its web screen catches up with the phone's redesign.

**The phone still leads design.** A Module is designed and built on the phone
first. Its web port follows right after, in its own issue, on the shared web
module layout ([APP-300](https://linear.app/appelent/issue/APP-300)). The web
port looks native to the web ([ADR-0017](0017-the-phone-owns-its-look-and-shares-its-words.md))
and shares the phone's words.

| Module | Status in `features.ts` | Web port |
| --- | --- | --- |
| Tasks | `parity` | [APP-308](https://linear.app/appelent/issue/APP-308) |
| Notes | `pending-port` | [APP-351](https://linear.app/appelent/issue/APP-351) |
| Calendar | `pending-port` | [APP-344](https://linear.app/appelent/issue/APP-344) |
| Groceries | `pending-port` | [APP-316](https://linear.app/appelent/issue/APP-316) |
| Meal planner | `parity` | [APP-322](https://linear.app/appelent/issue/APP-322) |
| Shared costs | `pending-port` | [APP-329](https://linear.app/appelent/issue/APP-329) |

Until a port lands, its web route stays a `ModulePlaceholder` owned by
`planned-web-modules`. The port's PR moves the route into the Module's own
entry and sets it to `parity`.

**Unchanged from ADR-0042:** the floor, share targets, the phone-only Search
tab, Quick add, Drop and Labs. Pantry, recurring costs and savings goals stay
`exclusive` to the phone with a web placeholder, pending
[APP-83](https://linear.app/appelent/issue/APP-83).

## Consequences

- A phone issue for one of the six Modules has a sibling web issue. The phone
  issue does not wait for it, and the web issue does not start before the
  phone version and the web module layout exist.
- Web routes for these Modules may hold real screens. Anything they show is
  already covered by data export and deletion, which are by table on both
  platforms.
- Removing a Module's web version again needs a new ADR that supersedes this
  one for that Module.

## Rejected

- Keeping the phone-only split of ADR-0042: Eric chose web versions for these
  six on 18 Nov 2026.
- Building phone and web in one issue per screen: each port would wait for two
  designs and two reviews, and the phone leads.
- Web ports for pantry, recurring costs and savings goals now: not part of the
  decision; APP-83 still decides them.

## Reopen when

- Eric decides pantry, recurring costs or savings goals (APP-83).
- The web becomes the leading platform for any of the six Modules.
