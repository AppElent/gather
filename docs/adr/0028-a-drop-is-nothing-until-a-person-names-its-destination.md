# A Drop is nothing until a person names its destination

Status: decided (2026-08-25)

## Decision

`apps/mobile` registers **one** share target on iOS and Android, and it opens
the app. What arrives is a **Drop** — a link, some text, or a photo — and it has
no Group and no Module until a person names them.

`expo-share-intent` is the mechanism, on the major line whose peer range matches
the app's Expo SDK. The rejected alternative renders a custom view inside an iOS
share extension: a second process that would need a Keychain access group to see
the Clerk session and an App Group to see the current Group, in order to draw a
sheet too small to name a destination Group in — which
[ADR-0015](0015-the-group-is-addressed-on-the-web-and-ambient-on-the-phone.md)
requires of every mobile write.

A `DropProvider` at the root layout holds at most one pending Drop, above both
the signed-in gate and the Group provider's pending/none gate. In memory only:
an image's `file://` URI must stay live until upload, and a long text Drop has
no business in a route param. Navigation carries only which target was chosen.

The chooser is two stages. Stage one is drawn from a static registry filtered by
payload kind and needs no data of its own; stage two appears only for targets
that append to an existing record, and is allowed to load. **Nothing expensive
runs before a person confirms** — no fetch, no model call. A target whose Module
is empty is still listed, because
[ADR-0022](0022-a-module-is-configured-by-its-content-not-by-a-switch.md) says
an empty Module invites you to make its first thing.

Ranking is declared per payload kind, overridden by a table of host rules that
**preselect and never restrict**. Every destination stays on the sheet: a stale
rule costs one tap, never a dead end.

The chooser names the Drop's save location. Confirming switches the app's Group
to it and lands the person on what they made — because
`docs/mobile-interaction.md` says the confirmation *is* the screen changing, and
a write into a Group you are not standing in has no confirmation available to
it. No per-write Group and no Group picker anywhere else: the Group remains a
place rather than a field.

An App Group is still declared, and that is not the rejected design creeping
back. Shared *files* arrive in a container the app has to be entitled to read,
so a photo Drop needs one on iOS whatever else is true. What the rejected route
needed it for was different and much larger: reaching the Clerk session and the
current Group from a second process, in order to draw the sheet there instead of
here.

## Consequences

A recipe found in Safari reaches Gather in two taps instead of a copy, an app
switch, and three screens of navigation. The same door serves notes, tasks,
grocery lines and photos, and a Module that wants to receive something declares
it rather than building an entrance.

**Import keeps its meaning.** A Drop into Recipe *is* an Import as `CONTEXT.md`
already defines it — a reading of a page, never a recipe until a person has
looked at it. **Share keeps its meaning too**, which is why the new noun is not
called one: Share is making Group content visible to a second Group, and the
word was already spent.

The chooser stays in the navigation stack, so Back from a destination that
refused the Drop returns to it with the same Drop still pending. Recovery
therefore needs no per-destination affordance, and works for failures nobody
predicted.

The registry is separate from `QUICK_ACTIONS`, which describes something
adjacent — the Add tab's capture verbs. The two will drift. That was accepted in
exchange for the Drop registry being exhaustive over `ModuleId`, which
`QUICK_ACTIONS` is not.

The host table's positive entries change no behaviour on the day they are
written, since Recipe already wins for URLs by declared order. They record
intent and hold if that default ever moves. The negative entries earn their keep
immediately: each one prevents a page with no recipe structured data from
falling through to the model fallback and failing several seconds and one paid
call later.

This is a config-plugin change, so under
[ADR-0028](0028-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)
it moves the fingerprint and **cannot ship over the air**. Installs that do not
take a new build never see it.

The share sheet cannot be driven by the device automation this project uses, so
the Drop entry point needs a deep-link harness that simulates an arriving Drop
before any of it can be verified the way `CLAUDE.md` requires.

## Enforcement

`apps/mobile/src/drop/dropTargets.ts` is an exhaustive record keyed by
`ModuleId`: a Module that accepts nothing declares an empty list explicitly, so
**adding a Module is a compile error until someone answers the question**. This
is deliberately unlike `moduleDestination.ts`, the seed contributions, the
breadcrumb trails and the quick actions, all of which fail silently and are kept
honest only by a line in `CLAUDE.md`.

The ordering decision is a pure function tested in the `mobile` node project
beside `quickActions.test.ts` and `moduleDestination.test.ts`. The
never-restrict guarantee is asserted directly, because it is the rule a later
change is most likely to break quietly.

`hostRules` lives in `packages/core` with no dependencies, so the web's own
importer can adopt the negative guard without a second table.

## Reopen when

A destination needs a reading of a page that the recipe importer does not give
it — Houses from a listing is the expected first — and a generic page reader
must therefore exist; or the share extension route becomes viable because the
Clerk session and the current Group can be reached from a second process without
an App Group each; or the web earns a PWA `share_target`, at which point the
Group-in-the-URL question this decision sidesteps has to be answered; or the two
capture registries drift far enough that one list is cheaper than the drift.
