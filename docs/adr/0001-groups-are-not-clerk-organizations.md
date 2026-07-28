# Groups are not backed by Clerk Organizations

Status: accepted (2026-07-28)

Gather already uses Clerk for authentication, so backing the Group boundary with
Clerk Organizations — getting membership, roles, email invitations and a members
UI for free — is the obvious move. We rejected it. Convex remains the single
source of truth for Groups and their membership, and Clerk is used only to
identify the person signing in.

## Considered options

**Clerk Organizations.** Attempted in full in PR #10 (`codex/space-centered-gather`,
closed unmerged). Two problems killed it. First, Gather shares its Clerk
application with other AppElent apps, so scoping the org claims required an
additive change to a *shared* JWT template that Gather has no authority to make
and no way to smoke-test across the other consumers — the branch's own
`docs/setup/clerk-shared-application.md` recorded the work as blocked for this
reason. Isolating Gather's own orgs within the shared instance then required
marker metadata, a synthetic slug convention, and membership/invitation
filtering everywhere. Second, it put Group identity behind a webhook: Convex had
to mirror org state, which meant a `deleting` status, a per-module
`pending | failed` deletion column, and reconciliation logic for the window where
the two disagree.

**Clerk for membership, Convex for everything else.** Narrower, but keeps both
of the above: still a shared-template change, still two masters.

## Consequences

We build invitations, role changes, removal and leaving ourselves. That is real
work we would otherwise have got for nothing, and it is the honest cost of this
decision. In exchange, a Group is one row in one database, readable in one
query, with no distributed state to reconcile — and the boundary is not coupled
to an auth vendor shared with other products.
