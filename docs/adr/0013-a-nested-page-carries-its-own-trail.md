# A nested page carries its own trail, and back is an address

Status: accepted (2026-08-11)

Every route below a Module's index renders a `Breadcrumbs` with the trail from
that index down to itself. The shell keeps global navigation; the page owns the
local hierarchy, because the page is the only thing that knows it.

## Why the page and not the shell

The Topbar, Sidebar and dock render above the route. They can name the Module
you are in — that is a fact about the URL — but they cannot know that this page
is a food, or that food's edit form, or which food. `getRouteContext` maps
segments to Modules and stops there, and teaching it the rest would mean
teaching it every collection, every detail route and how to read a title out of
data the shell has not loaded.

So the trail is a prop. A page assembles it out of what it has already fetched
and hands it over. Nothing derives it from the URL a second time.

## Back is an address, never `history.back()`

The browser's history is where you came *from*. On a detail page opened from
Home, from a search, or from a notification, that is not the collection the
page belongs to — and going "back" to a search result you have already used is
not what a back button on a food page means.

Pointing at the parent address gives the same answer however somebody arrived,
and it carries the Group with it for free, because every `AppLink` is built by
`groupPaths` (ADR-0002). The global back gesture continues to do what it always
did; this is a different question, answered separately.

The parent is the last step in the trail that has a link, read from the end
rather than taken at `length - 2`. That is what keeps a half-built trail
useful: a detail page knows its Module before it knows the thing it is showing,
and while that is still loading the collection is the only step there is — and
is exactly where back should go.

## Labels are the caller's job

`Breadcrumbs` takes strings that are already in the reader's language and never
reaches into the message tree on a page's behalf. Half of any trail is
*content* — a food's name, a recipe's title, a child's name — and content is
never translated (ADR-0011). A component that resolved its own labels would
have to be told which half is which on every call, which is the same work with
an extra rule attached.

## One list, two renderings

A phone gets a single back action to the immediate parent; anything wider gets
the hierarchy. Both are in the markup with one `display: none`, so the reading
order is identical and neither is a second definition of where the page sits.
Rendering one *or* the other on a width guess would make the trail depend on
when the component decided to measure.

The current page is the one step with no link, and carries `aria-current="page"`
— which is what tells a screen reader the trail has ended rather than that the
last link is broken.

## What this does not cover

Flat shell pages — Settings, Account, Groups — get nothing. They sit directly
under the shell, which already names them, and a one-step trail is chrome that
says nothing.

A route that is a *dialog over* its parent does not need this either: the add
sheet already closes back to the diary because that is what its route does.

## Consequences

**Every new nested route adds its trail in the same change.** There is no
registry that would show a gap, and no test that fails for a page that quietly
renders without one, so the rule lives in `CLAUDE.md` where the next person
adding a route will read it. A collection index does not get a trail; its
children do.

The cost is a few lines per page and one more thing to remember. The
alternative — deriving trails centrally from the route tree — was rejected
because it needs a title for every dynamic segment, which means the shell
loading data it otherwise has no reason to load, on every route, in order to
render a line of text above the page that already has it.
