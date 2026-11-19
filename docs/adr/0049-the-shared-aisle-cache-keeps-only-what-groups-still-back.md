---
type: decision
description: Read before changing the shared grocery aisle cache, the consensus rule, its retention, or what the grocery AI fallback logs.
version: 1.0.0
status: accepted
date: 2026-11-19
---

# The shared aisle cache keeps only what Groups still back

APP-353 gave the grocery list a shared cache (`groceryCategoryCache`) for names
the bundled dictionary does not know: one question to a small model, answered
once for every Group, and moved when enough Groups correct it. The cache is
keyed by the normalised name a Member typed and holds no Group or person id, so
neither Group nor account deletion can find the rows that came from them
([account deletion](../contracts/account-deletion.md)). Short personal text
that passes `isAskableGroceryName` would stay there, and in the function logs,
for good. APP-369 bounds that, and records the consensus rule that APP-353
built.

## Decision

**The consensus rule.** A Group's correction is its own answer for the name at
once (`groceryCategoryOverrides`). The shared answer for a name the dictionary
does not know follows the Groups when at least three Groups, corrected by at
least three different people, chose the same aisle, and more Groups chose it
than chose the shared answer it would replace (`recordGroceryCorrection`,
`CONSENSUS_GROUPS`). A consensus outranks the model; the model never
overwrites it. Names the dictionary knows, and names that may not be sent to
the model, are never shared.

**What this allows.** Three accounts, each in a Group of its own, can set the
shared answer for a name nobody else has corrected. The answer is only an
aisle from the fixed list, it only reaches names the dictionary does not know,
each Group's own correction still wins for that Group, and more Groups choosing
otherwise outvote it. No extra guard (such as a minimum account age) is added
now: the harm is one item in the wrong aisle, which any Member fixes for their
Group in one tap. Revisit if Gather opens sign-up beyond invitation or the
cache starts answering names the dictionary knows.

**Retention.** A daily job (`groceryCategories.prune`, `convex/crons.ts`)
drops what no Group backs any more:

- a model answer 30 days after it was given (`AI_ANSWER_RETENTION_MS`); the
  next Group to type the name asks again, from the same daily budget;
- a consensus whose three Groups no longer agree, because Groups were deleted
  (their corrections go with them) or changed their choice;
- a question that never got its answer, after `PENDING_STALE_MS`.

Items already sorted keep their aisle: it is stored on the item, which belongs
to the Group and goes with it.

**Logs.** The grocery fallback logs the aisle and the outcome, never the name.

## Consequences

- A name a Member typed once leaves the shared cache within about 30 days,
  and a consensus within a day of losing its backing.
- A popular unknown name is asked of the model about once a month instead of
  once. At the 300-a-day budget this is a small cost; the budget, not the
  retention, caps spending.
- **Timing probe (accepted).** A Member can tell whether a name was in the
  cache: a cached name gets its aisle when added, an uncached one moves a few
  seconds later. That reveals that some Group typed the name in the last 30
  days, never which Group. Retention bounds it; hiding it would mean delaying
  every cached answer, which this ADR does not do.
- Logs written before APP-369 still carry names until Convex's log retention
  drops them.
