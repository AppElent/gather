# PROTOTYPE — a new five-slot tab layout

> Round two: five variants that agree about the bar and disagree only about
> **Add**, switchable from a floating pill, on the existing `app/(app)/(tabs)`
> layout.

**Throwaway.** Nothing here is production code: no tests, no message-tree
entries, no real mutations. It exists to answer a question and then be deleted.
It lives on the `prototype/mobile-tab-layout` branch and must not be merged to
`main`.

## Verdict

Settled on a device, 2026-08-16. Three answers, and each contradicts something
already written down — see the amendment list on #172.

1. **The bar is five native slots: Home, Search, Add, Profile, All.** #172
   specifies four with no Profile; it is wrong and gets amended.
2. **Add is variant E** — a `disabled` `NativeTabs.Trigger` whose `tabPress`
   opens the launcher. The slot does not render dimmed, which was the whole
   risk. So Add keeps a real `UITabBarItem`, opens a sheet over wherever you
   were, and never navigates: five slots *and* #172's story 5, with no native
   chrome given up and one implementation for both platforms. D, F, C and B are
   kept below as the range it was measured against.
3. **A quick action declares its own kind** — `row`, `sheet` or `handoff`, on
   the action rather than as a mode of the shell. #172's shell seam has to carry
   it, or every action is dragged to the slowest one's behaviour and Add stops
   being a quick add.

Still open, and cheap to settle with the second pill: which `kind` each
individual action gets. "Import from a link" is the one genuinely in doubt.

**#172 is the only authority cited below.** A draft ADR-0018 and a set of
CONTEXT.md glossary entries existed while this prototype was being built, and
were abandoned rather than committed — the prototype had already contradicted
them on every point that mattered, and amending a wrong record is worse than
writing a right one once. So the decision record for all of this is still to be
written, and `docs/adr/0018` is the number waiting for it.

## Round one, and what it settled

The shipped bar spends three of its five slots on Modules (Recipes, Tasks,
Nutrition), which #172 rejects. The proposed replacement was Home, Search,
Add, Profile, All — and two entries in that list were not obviously slots.

**Profile is settled: it stays, and it owns its own stack.** Variant A gave it
a slot whose three rows each pushed *above* the tabs, so the bar vanished on
every tap — correct for a gear on Home, wrong for a permanent destination.
Variant D nested those pushes inside the tab instead and won. A is retired.

That decision contradicts issue #172, which specifies four tabs with Settings
entered from Home. **It needs amending before any of this is implemented** —
the prototype is evidence, not authority.

**Add is still open**, and it is what round two is for.

## The question round two answers

Add is a verb, not a place. #172 says it "opens as a sheet above the current
route" and returns you to where you were. The first round could only offer that
by giving up the native bar — until two things turned up in the `expo-router`
typings that were not known when A/B/C were written:

- **`NativeTabs.Trigger` takes `disabled`**, which keeps the item in the bar,
  suppresses native selection, and *still emits `tabPress`*
  (`isPrevented: true`). A native slot can therefore open a sheet and go
  nowhere. That is variant **E**.
- **`NativeTabs.BottomAccessory` exists** — a real
  `UITabBarController.bottomAccessory`, iOS 26+. C's pill, except it belongs to
  the bar instead of floating over it. That is variant **F**.

Every variant below has the same five-slot native bar with the nested Profile
stack. Only Add moves.

## The variants

Ordered by how much of the platform's own furniture the treatment keeps, most
first — so cycling right is cycling away from native.

| | Add is… | Native bar? | Costs |
|---|---|---|---|
| **D** — Add is a place | a **destination** (`proto-add`, a grid of actions) | full | contradicts #172; you have to leave a place you never wanted to be |
| **E** — Add is a native slot, opens sheet | a `disabled` trigger whose `tabPress` opens the launcher | full | **may render dimmed** — the whole risk |
| **F** — Add in a native bottom accessory | a `NativeTabs.BottomAccessory` (4 slots + accessory) | full, iOS 26+ | iOS-only; Android and older iOS need C's pill shipped alongside |
| **C** — Add is a floating pill | an app-drawn pill above the bar (4 slots) | full, but the pill is not part of it | pill does not minimise with the bar; reads as debris on top |
| **B** — Add is a raised FAB, JS bar | a lifted centre **⊕** on a hand-drawn bar | **none** | the only one that can lift Add; gives up minimise-on-scroll, ripple, Dynamic Type, tab a11y semantics |

Each variant file opens with the case it is making and the cost to watch for.

## Settled: a quick action declares its own kind

The first pass stubbed this out — rows printed "Would open: …" — which hid the
question that actually decides whether Add feels like a quick add. The spec is
split against itself on it:

> **Story 5:** Add opens **without losing my current place**, so a quick capture
> does not interrupt what I was doing.
> **Story 7:** every Add choice **takes me to the owning Module's quick flow**,
> so each record uses its established validation, scope and save behaviour.

Both are right, because they are describing **different actions**. So the shell
does not choose: **each Module declares the kind of its own quick action**, and
the launcher obeys. `QuickAction.kind` is one of three:

| `kind` | What a tap does | You end up |
|---|---|---|
| **`row`** | the row grows a field in place; the other actions stay on screen | exactly where you were, launcher still open — add three tasks without it closing |
| **`sheet`** | the body swaps to that action's two or three fields, with a back chevron | where you were, after one dismiss; room for more than a title, and for an outcome |
| **`handoff`** | the launcher closes and pushes the Module's create form | in a full-screen form with the tab bar gone, finding your own way back |

As assigned today, from the three live Modules:

- **`row`** — Add a task. A task *is* its title.
- **`sheet`** — Import from a link (a URL, then something to report about what
  it found); Log a meal (a food and a portion).
- **`handoff`** — Write a recipe (long-form, its own editor); Scan a barcode
  (needs a camera).

Only Tasks earns `row` among the live Modules. That is not an argument against
the kind — a shopping-list item and a note are both one field, and both are
coming.

**This is the amendment #172 needs.** Its shell seam — "each Module declares or
otherwise exposes its available quick actions" — has to carry `kind`, or the
shell picks one behaviour, every action is dragged to the slowest one's, and Add
stops being a quick add.

### What is still open: which kind each action gets

`kind` is now a per-action judgement, and the second pill is how you make it —
it forces every action to one kind so you can try the same action both ways.
Is "Import from a link" better as a row than a sheet? Force `row`, try it, force
`sheet`, try it, then write the answer into `actions.ts`. `declared` is the
default and the only setting that shows the real design.

## What to look at, in order

1. **E first, and only one thing about it.** Does the Add slot render grey and
   dead next to four live ones? UIKit dims a disabled `UITabBarItem` and
   Material greys a disabled item, so this is a real risk, and it decides E.
   **Check both platforms** — one of them looking fine is not an answer. If E
   survives, it is the answer: five slots and a sheet, no native chrome given
   up, no second implementation for Android.
2. **If E is dimmed**, does `unstable_nativeProps` restore the appearance? If
   not, E is out.
3. **Then F on iOS 26.** Does the accessory minimise with the bar on scroll —
   and if it does, is there still a way to create once it has gone?
4. **Then F on Android**, where it falls back to C's pill. F means shipping two
   different primary create controls and maintaining both. Decide whether that
   is acceptable before preferring it to C.
5. **D and B are the ends of the range**, kept so the middle has something to be
   measured against.

Then, on the second pill, the question is no longer *which* behaviour but
whether a **mixed** sheet holds together:

6. **Leave it on `declared` and open the launcher.** Three kinds of row sit in
   one list, each tagged with what it will do — "Tasks · in the row", "Recipes ·
   opens a form". Does that read as a range of speeds, or as inconsistency? If
   it reads wrong, the tags are the first thing to change, not the kinds.
7. **Tap "Add a task", type, Save, and add another** without the sheet closing.
   That is what the whole design is for.
8. **Then "Log a meal"** and notice the body swaps rather than the row growing —
   two fields need the room.
9. **Then "Scan a barcode"**, which leaves, because it has to. Decide whether
   the chevron is enough warning that this one is a different kind of thing.
10. **Then force each kind in turn** to settle the per-action assignments that
    are still open — especially whether "Import from a link" is really a sheet.

## Running it

```
pnpm --filter @gather/mobile start    # then open the development build
```

(`ios` only works from a Mac; on Windows start Metro and connect the device.)
The prototype is pure JS — no native modules, no `app.json` change — so an
existing development build needs a **reload**, not a rebuild.

Sign in, then use the two black pills at the **top centre**. The upper one
cycles the bar, `D → E → F → C → B`. The dimmer one under it forces every quick
action to a single kind — leave it on `as each Module declares` to see the real
design, and use the other three only to compare one action against itself. Top rather than bottom because the bottom of the
screen is the thing being judged. Both are `__DEV__`-only.

Do this on a real build, not web: `NativeTabs` is the whole point of D, E and F,
and the web renderer is an approximation of it. F needs iOS 26 to show its real
form at all.

**If you ever land on the Add screen from E or F, that variant has failed** —
say so. The `proto-add` route still exists because the navigator needs a screen
behind every slot, and reaching it means the press was not intercepted.

## Known consequences, not bugs

- **Settings → Account escapes the Profile stack.** `app/(app)/settings.tsx`
  pushes `/account`, the flat address, so it leaves the tab and takes the bar
  with it. Nesting a screen means re-pointing every link *inside* it, and that
  work does not stop at the three re-exports.
- **The nested child screens were padded for a full-screen push.** They end at
  `insets.bottom + 24`, sized for no tab bar beneath. Watch whether
  `NativeTabs`' automatic content insets cover the difference.
- **Nothing is saved.** "Added: …" is in-memory and dies when the sheet closes.
  The question is what capture *feels* like, not whether the mutation lands.
- **Keyboard-over-sheet is only roughly handled.** A `KeyboardAvoidingView` with
  `padding` on iOS and nothing on Android — enough to judge the interaction, not
  enough to ship. If the field is covered on Android, that is the prototype, not
  the design.

## What is temporary, and where

| File | What happens to it |
|---|---|
| `src/prototype/tabLayout/**` | deleted whole |
| `app/(app)/(tabs)/proto-search.tsx`, `proto-add.tsx` | deleted; the winner's screens get written properly. If E or F wins there is no Add *screen* at all |
| `app/(app)/proto-create.tsx` | deleted. It is a stand-in for each Module's real create form, which already exists on the web and has to be built here regardless — a capture field never removes the need for the full editor, it only removes the need to *start* in it |
| `app/(app)/(tabs)/proto-profile/` | deleted whole. The three re-exports become real moves: `app/(app)/{account,groups,settings}.tsx` move into the tab's folder, the root `Stack.Screen`s go, and every `router.push` at the old addresses is re-pointed |
| `app/(app)/(tabs)/_layout.tsx` | revert to `ShippedTabs`, which is unchanged at the bottom of the file |
| `app/(app)/_layout.tsx` | drop the `<View>` wrapper and the `PrototypeSwitcher` import |

## Deliberate deviations from house rules

- **English literals, not the message tree.** CLAUDE.md requires every
  user-visible string in `messages/{en,nl}`. Prototype copy is not
  user-visible — it never ships — and translating throwaway screens buys
  nothing. The winner's strings get written properly when it is folded in.
- **A module-level store, not a `?variant=` search param.** The thing being
  varied *is* the navigator; a search param lives on a route, and here the
  route tree changes underneath it.
- **Duplicated triggers across D, E and F.** The four settled slots are copied
  into each file rather than shared. Sharing them would mean wrapping
  `NativeTabs.Trigger`, which `isNativeTabTrigger` would stop recognising — and
  a prototype's variants are supposed to be free to throw out their own layout.

## Switching variants remounts the navigator

Expect to land back on Home after each switch. That is the prototype's
scaffolding, not a property of any of the designs.
