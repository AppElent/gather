# Modules live inside the tab stacks

Status: decided (2026-08-19), not yet implemented

Baby log is the first Module on the phone to need a stack. Until now a Module has
been a leaf — `home/[moduleId].tsx` and `all/[moduleId].tsx`, two thin files both
rendering `ModuleRoute`, with nothing to push into. A child log has a child, a
child has settings, and both are pages below the Module's root.

That raises where those pages live, and the attractive answer is wrong.

**The attractive answer:** give every Module one top-level address —
`/module/[moduleId]`, or `/baby` — and reduce All and Home to link lists. One
address per Module, no Module reachable two ways, and `groupLink.ts` retargets
once. It also *sounds* like what
[ADR-0018](0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md)
wants, since that ADR says the bar names app-level capabilities and never
Modules — so a Module might seem to belong outside the bar entirely.

**We rejected it. A Module's screens live inside each tab's stack**, as thin
files re-exporting shared screens from `src/modules/baby/` — the convention
`ModuleRoute` already set, extended rather than replaced.

## What a top-level route actually costs

A route outside the `(tabs)` group is pushed full-screen over the bar. Every cost
below lands on the tab bar, and they are not small:

| Cost | Why it matters here |
| --- | --- |
| **The bar disappears while you are in a Module** | Add is the quick-log launcher. Losing it *inside* the Module that most needs quick logging is the decisive one |
| **No selected tab** | Keeping the bar visible over a route belonging to no tab means drawing it in JavaScript — the exact fallback ADR-0018 rejected for the Add slot |
| **Per-tab position is gone** | Today All remembers where you were. With no tab holding your place, leaving a Module means leaving it |
| **A cold-start deep link has nothing beneath it** | Back exits the app unless `/home` is seeded under the push. A tab-nested route gets its tab root for free |

Android hardware back is fine either way as long as the route is pushed rather
than replaced, and
[ADR-0013](0013-a-nested-page-carries-its-own-trail.md)'s trail rule is satisfied
either way. Those are not the reasons.

## The price we are paying instead

**A Module is reachable at two addresses** — under Home and under All — and its
screens exist as two thin route files each. That is the cost, stated plainly so
nobody discovers it and assumes it was an oversight. It buys a bar that is always
there, a native back stack per tab, and Add one tap away from anywhere inside a
Module.

The duplication stays thin on purpose: the route files are two-line re-exports
and every screen lives once, under `src/modules/<module>/`. If a Module's route
files ever grow logic, that is the smell to fix — not the two addresses.

## What would reopen this

A way to keep the native bar visible **and** coherently selected over a route
that belongs to no tab. The decision is about what `NativeTabs` can express, not
about what a Module deserves — so if the platform grows that state, the
attractive answer becomes available and this ADR should be re-argued rather than
cited.
