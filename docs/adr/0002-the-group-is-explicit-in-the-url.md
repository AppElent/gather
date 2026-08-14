# The Group is explicit in the URL

Status: accepted (2026-07-28)

Every Group-scoped route is addressed as `/g/<slug>/…`. Previously the active
Group was implicit — a stored default on the user — so `/recipes` rendered
different content depending on hidden server state.

## Why

The implicit model made three things impossible or unsafe: two Groups could not
be open in two tabs, no link was addressable ("this recipe, in that Group"), and
every query re-derived the active Group for itself instead of it being checked
once at the route boundary.

The slug is deliberately human-readable rather than an opaque id. Creating
content takes its destination from the current route, so the Group you are
acting in has to be *noticeable* — `/g/jansen-household/recipes/new` tells you
where an imported recipe will land; an id does not. That safety property is the
reason for the extra work of global uniqueness, collision suffixes and a
reserved-segment list.

## Consequences

Slugs are globally unique, which means Personal groups compete for the same
namespace as household names and need a distinct prefix. Renaming a Group breaks
existing links. Both are accepted: the alternative — slugs unique only within
your own memberships — would make the same URL mean different things to
different people, which breaks sharing entirely.

This describes the web app. `apps/mobile` keeps the Group ambient rather than
addressed, and repays the noticeability the slug is bought for at the point of
write instead — see
[ADR-0015](0015-the-group-is-addressed-on-the-web-and-ambient-on-the-phone.md).

Modules whose data is Personal (Nutrition) still render under a Group route and
show the same content in every Group. The segment governs navigation there, not
ownership. This is a known and accepted inconsistency; hoisting those Modules to
top-level routes would split navigation into two systems, and would break down
for any Module with both shared and personal parts.
