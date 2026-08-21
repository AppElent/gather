# The Group is addressed on the web and ambient on the phone

Status: decided, not yet implemented (2026-08-13)

[ADR-0002](0002-the-group-is-explicit-in-the-url.md) put the Group in the URL, and
everything the web app knows about which Group you are in it reads from a path
param. `apps/mobile` does not do that. **A Group on a phone is a place you are
*in*, not a place you are *at*.** `NativeTabs` sits at the root, the current
Group lives in a persisted context, and no tabbed route carries a `groupSlug`
segment.

This is a new ADR rather than an edit to 0002 because 0002 is correct and
unchanged for the web. Its reasoning is what makes the slug worth its cost
there; rewriting it would erase that, and its Why section would then argue two
ways at once. The precedent is already in the repo —
[ADR-0007](0007-a-write-happens-at-the-address-that-names-its-group.md) refined
0002's territory in its own file and left 0002 standing.

## ADR-0002's three reasons, tested against a phone

| ADR-0002's reason | On a phone |
| --- | --- |
| Two Groups could not be open in two tabs | **Evaporates.** One app, one foreground state |
| No link was addressable | **Strengthens** — and is the one reason the chosen runtime cannot collect |
| The Group was checked once at the route boundary | **Indifferent.** A context is as much a single source of truth as a path param |

The middle row is the interesting one. Addressability is the argument that
*gains* force on a phone, where a link arriving from outside the app is how most
things start. But [#139](https://github.com/AppElent/gather/issues/139) found
that **Expo Go cannot register custom URL schemes**, so under the chosen runtime
the `gather://` scheme already declared in `apps/mobile/app.json` is inert. A
deep link cannot arrive to be addressed. The reason is real and unavailable at
the same time.

It is not abandoned. A thin `app/g/[groupSlug]/[...rest].tsx` route exists
solely to consume a deep link — set the Group, `router.replace` onto the
equivalent tabbed route — and does nothing until the app leaves Expo Go for a
development build. The consumer shape is decided; only the delivery path is
missing.

The decisive structural argument is
[#142](https://github.com/AppElent/gather/issues/142)'s: **the native tab set
cannot vary by Group anyway.** Putting the tabs under `[groupSlug]` therefore
buys nothing and costs an unverified question — what a navigator does when a
dynamic segment *above* it changes params. Tabs at the root means that question
never arises.

Rejected: a **hybrid**, path for content mirrored into a store.
`useNavigation.ts`'s own comment is the standing warning — *"Two lists that have
to agree eventually stop agreeing."* Rejected too: **a stored active Group on
the `users` row**, which is precisely the model ADR-0002 was written to delete,
and which would let the phone silently change what the web's shell defaults to.

## Noticeability is repaid at the point of write

0002 pays for a human-readable slug with global uniqueness, collision suffixes
and a reserved-segment list, and the thing it buys is *noticeability*:
`/g/jansen-household/recipes/new` tells you where an imported recipe will land.
**That purchase is unavailable on a phone**, which has no address bar. The slug
would be paid for and never read.

So the phone repays it where it actually matters:

- every create, edit, delete and import surface **names its destination Group in
  its own copy** — *"Adding to Jansen Household"*;
- Home names the current Group, for ambient orientation;
- **read-only screens say nothing.**

There is no persistent Group name in app chrome. #142 found a native header has
no slot for ambient context — it shows *this screen's* title — so a standing
Group line means hand-drawing a header on every screen and losing large-title
collapse, native back chrome and scroll-edge opacity, in order to state
something that matters on a handful of them. The name is also more legible than
the slug ever was, which is the one place the phone comes out ahead.

Naming the Group and switching it stay one control, as `GroupSwitcher`'s comment
already argued for the web: the Group name on Home opens an ephemeral native sheet.
It is not a route: switching Group is ambient shell state rather than a place,
and dismissal leaves the current valid destination in place.

## ADR-0007's rule survives verbatim

**Only the read site changes.** ADR-0007 says whether you may change something
follows membership of its home Group from anywhere, and *where* you change it is
the surface that names that Group. The phone compares the content's home Group
against the Group you are acting in exactly as the web does; it reads the second
one from context instead of `useParams`.

The guest case is identical — you are in `cooking-club`, you open a recipe homed
in `jansen-household` — and the behaviour ports as-is: one link to the home
Group, named, where Edit, Delete, Move and Unshare would otherwise be. The
backend enforcement is untouched, because it was never reading a URL.

**Nothing here makes write safety weaker on the phone.** An ambient Group is not
a looser Group. What ADR-0007 prevents is a write landing somewhere the surface
does not name, and the phone prevents it by naming the destination in the write
surface itself rather than in an address bar it does not have.

## Consequences

**`ShellGroup.tsx` has no native counterpart.** Its entire reason for existing —
the sidebar emptying on the way to `/groups`, where the web app is genuinely at
no Group — evaporates. With the Group in context there is no screen where the
app does not know it, and the question of what the shell does off any Group
dissolves rather than being answered.

**A Group switch resets every tab to its root.** This is the ambient model's
chief hazard: a stack sitting on Group A's recipe id would otherwise stay
sitting on it when the Group changes underneath. So setting the Group unwinds
every tab stack. The tab *navigator* is untouched — that is what keeping tabs at
the root bought — and switching Group always lands you at Home in the new Group.
This is `groupIndexSurfaceOf`'s existing rule expressed natively: land on the
module *index*, never the page you were on, *"since an id means nothing in
another Group."*

Rejected: **resetting only the active tab** — the stale id does not go away, it
waits, and surfaces one tap later as a Jansen Household task list under a header
saying Cooking Club, which is the exact confusion ADR-0007 exists to prevent.
**Resetting nothing and re-querying** — a screen holding an id cannot re-query
into anything, so every detail screen grows its own "gone" state, rebuilding
`GroupGate`'s four-state refusal N times and spending the one 0002 reason that
does survive.

**The Group is persisted locally and validated on read**, written to
`expo-sqlite/kv-store` — the same *synchronous* store
[#140](https://github.com/AppElent/gather/issues/140) chose for the locale, so
no second persistence mechanism and no first-frame flash of the wrong Group. On
cold start it is validated against `groups.myGroups` and falls back to
`landingGroupSlug(groups)`, which is pure TypeScript with no router import and
ports verbatim. Being removed from a Group is a real event, and the web's
`useShellGroup` already refuses to draw a remembered slug it cannot resolve.

**This deliberately reverses the web's choice, and the web's reason for it is
gone.** `ShellGroup.tsx` says the Group is *"Kept in React state rather than
storage, so it lives exactly as long as the shell does. Two tabs sitting in two
Groups keep two memories."* There are no two tabs. Meanwhile the OS kills
backgrounded apps routinely, and reopening a household app somewhere other than
where you left it is a bug on a phone even though it is correct on the web.

**Having no Group at all is a screen outside the tabs.** The race
`LandingRedirect` guards is backend behaviour and identical on both clients —
`ensureUser` creates everybody's Personal group on the same mount, so `myGroups`
arrives empty and fills a round-trip later — and `EMPTY_GRACE_MS = 5000` ports
as-is. Still empty after the grace guards to a create-or-join screen *outside*
`NativeTabs`, because a tab bar over an app with no content is chrome that leads
nowhere. The guard reads a settled Convex value, not the lagging Clerk↔Convex
handshake that `clerk-convex-dual-auth-redirect-loop` warns about; that trap is
about guarding on `isAuthenticated`, and this guards one layer below it.

## What would reopen this

**The app leaving Expo Go for a development build.** That is the moment the one
0002 reason that strengthens on a phone becomes collectable, and
`app/g/[groupSlug]/[...rest].tsx` starts receiving links. It does not reopen the
shape — the consumer route already exists for exactly this — but it is the only
change that would make an addressed Group cost less than it does today.
