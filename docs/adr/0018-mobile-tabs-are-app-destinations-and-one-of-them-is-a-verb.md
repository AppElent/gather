# Mobile tabs are app destinations, and one of them is a verb

Status: decided (2026-08-16), implemented, and amended on one slot (2026-08-17)

Supersedes the four-tab direction in
[#172](https://github.com/AppElent/gather/issues/172), which this ADR amends on
three points rather than records.

Gather mobile's tab bar currently promotes Recipes, Tasks and Nutrition — three
Modules out of thirteen — while Home separately offers the Group's Pins and All
holds the whole catalogue. That is two competing ways to reach a Module, and it
gives permanent space to whichever three happened to be built first.

**The bar stops selecting Modules and starts naming app-level destinations:**

| | |
| --- | --- |
| **Home** | the Group's shared summary, and what needs attention today |
| **Search** | records from live Modules in the current Group, Personal ones separately marked |
| **Add** | the action launcher — a slot that never takes you anywhere |
| **Settings** | everything you change about Gather, and the utility screens that belong to you |
| **All** | the complete Module catalogue |

Each slot earns its place by being a general capability that stays useful as
Modules land, rather than by being a Module. Opening a Pin or a Module from All
keeps its existing navigation.

Prototyped on a device before any of this was written; the variants and the
reasoning are on the `prototype/mobile-tab-layout` branch, which is the primary
source and does not merge.

**Amended 2026-08-17: the fourth slot is Settings, and was Profile.** A profile
is one of the things a person changes about Gather and there are going to be
many more — notifications, units, integrations, what Home shows — and a slot
named for the person has nowhere to put any of them that is not a surprise.
Named for the whole, it holds them by definition, and the profile loses nothing:
it is the first card in the list, still one tap from the bar.

This is the same test the other four slots pass and is why the amendment is not
a new decision. **Settings was always the general capability in that slot**; the
name was describing its most visible contents instead. Note what it does *not*
license: a slot is still a capability and never a Module, so a Module's own
preferences belong inside Settings and not beside it.

The shape that makes an unbounded list survivable — the platform's grouped list,
with a search field over it — was prototyped on the
`prototype/mobile-settings-tab` branch, which is likewise the primary source and
does not merge.

## Add is a native slot that opens a sheet

Add is a verb. Nobody wants to *be* in Add, so it must not be somewhere you go —
but a tab bar's slots mean "somewhere you can be", and that looked like a
contradiction that could only be resolved by drawing the bar in JavaScript.

It is not. **`NativeTabs.Trigger` accepts `disabled`**, which keeps the item
visible in the bar and suppresses the native selection while the navigator
*still emits* `tabPress` (with `isPrevented: true`). So Add is a real
`UITabBarItem` whose press opens the launcher over wherever you already were and
never changes the route.

The risk was appearance: UIKit dims a disabled tab item and Material greys one.
On device it does not read as dimmed. That fact is load-bearing — **if a future
SDK starts dimming it, this decision reopens**, and the fallback is the floating
pill described below.

A screen still sits behind the slot, because the navigator requires one. Nobody
should ever reach it. Landing on an Add *screen* is the defect this design
exists to prevent, and is worth treating as a bug rather than a curiosity.

Four alternatives were built and rejected:

- **Add as a destination screen.** Honest and simple, and it loses the argument:
  you go somewhere in order to leave it, and a full screen holding five rows is
  the emptiness that makes the slot feel wasted.
- **`NativeTabs.BottomAccessory`.** A real `UITabBarController.bottomAccessory`
  that rides and minimises with the bar — genuinely better than an app-drawn
  pill, and **iOS 26+ only**. Shipping it means shipping a second control for
  Android and older iOS, and maintaining both.
- **A floating pill above the bar.** Cross-platform and consistent, but app-drawn
  furniture sitting over the platform's: it does not minimise with the bar.
  Retained as the fallback if `disabled` ever renders wrong.
- **A hand-drawn bar with a raised centre button.** The only shape that can lift
  Add off the bar, and the only one that gives up the real `UITabBarItem` — with
  it iOS 26's minimise-on-scroll, Android's ripple, Dynamic Type, automatic
  content insets, free scroll-to-top and pop-to-top, and the accessibility
  semantics that announce a tab as a tab rather than as a button.

## A quick action declares its own kind

#172 pulls against itself: Add must open *without losing my current place*
(story 5), and every choice must *take me to the owning Module's quick flow*
(story 7). Both are right, because they describe different actions. A task is
its title. A barcode needs a camera.

So the shell does not choose. **Each Module declares the kind of its own quick
action** at the shared shell seam #172 already calls for, and the launcher
obeys:

| `kind` | What a tap does |
| --- | --- |
| `row` | the row grows a field in place; the other actions stay on screen; saving leaves the launcher open, so two things can be added in a row |
| `sheet` | the body swaps to that action's two or three fields, with a way back |
| `handoff` | the launcher closes and pushes the Module's own create surface |

Across the live Modules: `row` — add a task. `sheet` — import from a link, log a
meal. `handoff` — write a recipe, scan a barcode.

**Without `kind` the shell picks one behaviour, every action is dragged to the
slowest one's, and Add stops being a quick add** — which is the only thing it is
for. The kind belongs to the Module because only the Module knows what its
record minimally needs.

The launcher shows only actions that work. A placeholder Module contributes
nothing, and there is no registry slot to leave visibly empty, so **a Module that
gains a quick action declares it in the same change.**

## Settings owns its stack, and that is a new rule

Account, Groups and Settings are siblings of `(tabs)` in the root stack, so
opening any of them covers the tab bar. That is right for a gear on Home, which
is a way out of the shell. It is wrong for a permanent destination: a slot whose
entire content ejects you from the bar you just used is a slot that punishes
being used.

**So those three move into the fourth tab's own stack**, where a push keeps the
bar and a half-finished setting survives a trip to Search. Settings is the
stack's root rather than a screen inside it, and Account and Groups are pushes
from that root — as is every preference screen added later.

Worth stating precisely, because the code has been over-attributing it:
[ADR-0015](0015-the-group-is-addressed-on-the-web-and-ambient-on-the-phone.md)
does **not** say that everything outside the fixed set sits above the tabs. It
decides that the Group is ambient and that the tabs live at the root, and says
nothing about where the utility screens go. Several comments in `apps/mobile`
cite it for a rule it never contained. This ADR is where that rule is actually
made, and those comments should cite this one.

The cost, found in the prototype and named here so it is budgeted rather than
discovered: **nesting a screen means re-pointing every link inside it.**
`settings.tsx` pushed `/account` and `/groups`, so it escaped the stack and took
the bar with it. That work did not stop at the three files that moved, and any
link added to those screens later inherits the trap.

Paid twice, in the event: once on the move into the stack, and again when the
segment became `settings/` and every href inside it moved with it. The trap is
still open — a new preference screen that links to `/account` rather than
`/settings/account` ejects the bar exactly as before, and nothing but this
paragraph says so.

## What this does not decide

- **Which `kind` each individual action gets.** "Import from a link" is
  genuinely in doubt — one field argues for `row`, having an outcome to report
  argues for `sheet`.
- **The Search no-query state**, which #172 asks to be prototyped before
  implementation and which has not been. Focused field with private recent
  searches, versus a discovery feed.
- **Search's data shape.** `tasks` has no `groupId` — it hangs off
  `listId → taskLists.groupId` — so a Convex search index cannot filter by Group
  without denormalising it, which means a backfill and a `docs/migrations/`
  document. Recipes shared into a Group live in `sharedGroupIds` rather than
  `groupId`. Tasks in Notion and Todoist lists have no rows in `tasks` at all
  and are therefore unsearchable. That is a spike, not a slice.
- **Ask Gather**, which stays outside the bar while it is a preview.

## What would reopen this

- **`disabled` beginning to render dimmed** on either platform. The bar falls
  back to four slots plus the floating pill, and Add stops being a slot.
- **A fifth general capability earning a slot.** Five is Android's ceiling and
  the web's `DOCK_SLOTS`; a sixth destination is not an option, so a new one
  displaces an existing one and that is a decision, not a registry entry.
- **Ask Gather becoming useful enough to be permanent**, which is the most
  likely candidate for exactly that displacement.
