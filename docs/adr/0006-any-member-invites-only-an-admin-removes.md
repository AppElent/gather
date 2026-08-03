# Any Member invites; only an admin removes

Status: accepted (2026-08-03)

Letting somebody into a Group is any Member's to do: they read the Group's
invite code and pass it on. Taking somebody out is an admin's. The two halves of
"changing the membership" are deliberately not held by the same people.

## Why

A household is not an organisation with a gatekeeper. Asking Mum to wait for Dad
before her sister can see the recipes buys nothing that a family of four wants,
and a Group whose only admin is on holiday is still a household. So inviting is
not an administrative act, and `groups.inviteCode` is readable by any Member.

Removal is different, and the asymmetry is the point rather than an oversight.
Removing somebody is done *to* a person rather than offered to them, it is the
only membership change that takes content away from a reader, and it is the one
a household will want to be deliberate about — a departing lodger, an ex. It sits
with the same people who can rename and delete the Group.

## Consequences

**Removal only means something if the code rotates with it.** An invite code is a
bearer token: anyone who ever read it can rejoin through `joinByInvite` forever,
so an admin who removes a Member and leaves the code standing has not removed
them. Rotation is therefore part of removal rather than a separate button an
admin has to know to press — a forgotten rotation fails silently and leaves
somebody believing a door is shut. The cost is that rotating to lock one person
out also breaks the code another Member handed to their sister yesterday. In a
household that is one message to fix, and it is the cheaper of the two failures.

**One code per Group rather than a token per invitation.** Per-invite records
would let a removal revoke exactly the way one person got in, and would say who
let them in. They are also a table, a lifecycle and a page that a household of
four will never exercise. Revisit if invitations ever need to expire, be
withdrawn individually, or be audited.

**A Group can never be left unadministered.** `leaveGroup` refuses the last admin
of a Group that still has other Members, because nothing short of database repair
can put an unadministered Group right — there is no self-service way back into a
room nobody administers. `setMemberRole` is what unblocks that door.

**`myGroups` does not carry the invite code.** A capability is handed out by a
query that exists to hand it out, not by the one that answers "which Groups am I
in" for the sidebar, the switcher and the sharing panel. Same rule as
`groups.bySlug` and `groups.members`.
