# A Module is configured by its content, not by a switch

Status: decided (2026-08-19), not yet implemented

The mobile port of Baby log started from a request that every Module should show
a **setup screen when it is not set up**. That sentence has two readings, and
they produce different apps.

The first reading is a switch: a Group turns Baby log on, and until it does the
Module is inert everywhere. That overturns two entries in `CONTEXT.md` at once —
*Module* ("every live Module is available in every Group; a Group never enables
or disables one") and *Pin* ("pinning never enables a Module") — and
[ADR-0005](0005-pins-belong-to-a-person-in-a-group.md) exists partly to keep
those two ideas apart.

**We took the second reading. "Not set up" means empty, and an empty Module
invites you to make its first thing.** No enable flag, no new table, no Group
state saying which Modules are on. The glossary stands.

For Baby log this collapses further than expected: **creating the first child
*is* the setup.** There is no module-level setup step, because everything the
Module needs configured is a property of a child, not of the household. An empty
Baby log offers one action, and the create-child flow carries the configuration
— who, what to track, which lists.

## Tracked types are the concrete instance

A child's **tracked types** are the event types its log offers. Stored on the
`babies` row, so they are Group-scoped and both parents see the same log. The
field is optional and **absent means all eight**, which is what lets this land
without a backfill and leaves every web-created child and the Sample household
working untouched.

Per child rather than per Group, because a newborn logs feeding, diapers and
sleep while a three-year-old logs growth, medication and vaccinations, and a
household with both should not have to pick one shape.

**The load-bearing rule is what "off" does.** Turning a type off shrinks what you
are *offered* — the quick-log bar and the event-type picker — and nothing else.
Events already logged stay, stay visible in the timeline, and stay editable. A
parent who turns medication off and finds twelve medication entries gone has
been robbed of a record they may be showing a doctor; a preference must not be
able to do that. This is the rule most likely to be "tidied up" by someone who
reads the field name and assumes it filters the log, so it is the rule this ADR
exists to state.

**Both clients honour it.** The web's quick-log and type picker filter by the
same field, and the web's child edit form grows the toggles. A setting the phone
respects and the web ignores is not a domain concept — it is a phone feature
wearing a domain concept's name.

## Where it is reached

Settings gains a **Modules** section, and the Baby log row's value column carries
the Group's name — the Settings tab draws no Group chrome of its own, so without
it nothing on that screen says which household is about to be edited.

The row lists the children and drills into **the same child screen the Module
itself reaches**. One screen, two doors: nothing is duplicated, so nothing can
drift, and Settings is simply another way in rather than a second half of the
answer. This is also what
[ADR-0018](0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md)
licenses and limits — a Module's own preferences belong *inside* Settings and
never beside it.

## What was rejected

| Alternative | Why not |
| --- | --- |
| A per-Group enable flag | Overturns the *Module* and *Pin* entries and adds state whose only job is to make a Module unavailable |
| Tracked types per Group | One shape for every child; a newborn and a toddler forced to share it |
| Tracked types per person | Two parents would see different logs for the same child, and the log is the shared record |
| Refusing to turn a type off while events exist | Keeps an invariant nobody asked for and makes the setting a chore |
| Two layers: Group defaults plus per-child override | A second place the answer lives, and an unanswerable "I changed the default, did it change my child?" |

## Not generalised yet

The first-run screen is built concretely for Baby log. Baby log is the only live
Module on the phone, so a shared `ModuleFirstRun` would be designed against
exactly one example — which is how a generic component ends up fitting nothing.
It is extracted when a second Module wants one, from two real cases.

Note this is a different thing from `ModulePlaceholder`, which answers "this
Module is not built here yet". A promise about the future and an invitation to
act now are not one component.

## Amendment (2026-08-21): the field holds the noes

The original `trackedTypes` held the event types a household had said **yes**
to. Memory showed what that costs. It shipped, and every Child already on the
deployment went on not offering it — because "I turned this off" and "this did
not exist when I was asked" are the same absence in a list of acceptances, and
the log has no way to tell them apart.

So the record now holds `untrackedTypes`: the refusals. Anything nobody has
said no to is offered, and a type added to the catalogue arrives switched on
for everybody. Absent still means the household has never been asked, which now
means everything rather than eight specific things.

Three consequences worth stating, because each is a rule and not just a
side effect:

- **Every screen still asks the question the other way round.** A person is
  answering "which of these do you want?", not "which do you refuse?". The
  conversion is `declinedEventTypes` in `@gather/core/domain`, called on the
  way *out* of a form, and it is the only place a refusal list is built.
- **Membership and order are now separate fields for real.** `trackedTypes`
  used to carry both, because the settings screen wrote the bar's arrangement
  into it as a side effect. Order is `barOrder`'s alone; `untrackedTypes` is a
  set and is always read back in catalogue order.
- **Adding an event type is still a change to the seed and the message trees,
  but no longer a change anybody has to make in settings.** That was the
  actual defect: a shipped feature that every existing household had to go
  and find.

`convex/migrations.ts` converts the stored acceptances, subtracting them from
the catalogue *as it stood before Memory* rather than from today's — see
`docs/migrations/0001-baby-tracked-types-become-declines.md`, which is also
what retires that code.
