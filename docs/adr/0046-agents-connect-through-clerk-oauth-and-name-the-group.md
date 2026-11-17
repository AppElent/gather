---
type: decision
description: Read before changing how MCP clients authenticate, which MCP tools exist or may write, or how a connected app is gated in Convex.
version: 1.0.0
status: accepted
date: 2026-11-17
---

# Agents connect through Clerk OAuth and name the Group

Gather serves a remote MCP server at `/mcp` from the web Worker, so a Member can
connect Claude, ChatGPT or another agent and read and write their Groups'
recipes, task lists, notes and calendars. The implementation is copied from
Foundry's (its ADR 0016, `AppElent/workouts` `src/lib/mcp/`) and adapted to
Groups. Operating it is in the [MCP runbook](../runbooks/mcp.md).

## Authorization

Clerk is the OAuth 2.1 authorization server. Clients find it through protected
resource metadata (RFC 9728), register with CIMD (or DCR where it is on), and
sign the person in with PKCE. Clerk issues JWT access tokens whose `aud` is the
MCP endpoint URL (RFC 8707). The Worker verifies issuer, RS256 signature and
audience locally against Clerk's JWKS, then calls Convex with the same token,
which Convex trusts through a `customJwt` provider per URL in
`MCP_RESOURCE_URLS`. Gather and Foundry share one Clerk instance; the audience
keeps a Foundry token out of Gather and the other way round.

Two scopes split access: `gather:read` and `gather:write`. Write implies read.
Tools a grant does not cover are not listed; a token with neither scope gets
`403 insufficient_scope`.

## Convex enforces the boundary too

A client holding the token can call any public Convex function, not only the
ones the tools wrap. So identity resolves through one gate,
`convex/lib/connectedApps.ts`, used by `getCurrentUser` and `requireIdentity`
in `lib/sharing.ts`: an OAuth identity (it carries `client_id`) needs a Gather
scope, and without `gather:write` any mutation or action refuses it.

Every public action resolves a gated identity itself, because the queries an
action runs cannot see that their caller could write
(`convex/connectedAppsGuard.test.ts` holds this, and that nothing but
`connectedApps.ts` reads `ctx.auth`).

Some things stay in the app whatever the grant: deleting the account,
provisioning it, deleting or creating a Group, changing a role, leaving or
joining a Group, reading the invite code, connecting or disconnecting Notion
or Todoist, and the Sample household. Each calls `rejectConnectedApps`. A write
grant is otherwise trusted with the person's Groups the way the app is; "no
delete tools" shapes the MCP surface and is not a Convex rule for single
records.

## The Group is named on every call

On the web the Group is the Current Group (ADR-0031); an agent has no Current
Group. Every Group-scoped tool takes an explicit `groupId` from `list_groups`.
The tool layer checks it against the caller's own Groups and passes the slug to
the same Convex functions the app calls, which check membership again.

A Group id the caller is not a Member of and one that does not exist get the
same answer, `Group not found`, and so do the Convex refusals for an unknown
slug or a non-Member. This is stricter than the web's distinct Group refusals
(ADR-0009): those exist to be kind to someone who mistypes their own
household's slug, and an agent copies ids rather than typing names. Inside a
Group, "missing" and "in another Group" stay one answer, as everywhere
(ADR-0009); the calendar's `deleted` and `not-found` read the same.

## Writes

Write tools create or update; there are no delete tools. Every create tool
requires an `idempotencyKey`. The Convex create takes it as an optional
argument, because the app's own forms send none, and refuses a connected app
that omits it: `createOnce` (`convex/lib/idempotency.ts`) records `(user, key)`
in `idempotencyKeys` after authorising, and a replay returns the first row
instead of writing a second. A replay whose row has since been deleted creates
it again. A key reused for another kind of row is refused.

`update_recipe` writes the whole recipe back, because `recipes.update` takes
the whole document, so an edit made in the app between the tool's read and its
write is overwritten. The app's own editor has the same window.

## Considered options

- **Cloudflare Agents SDK** (the toolkit MCP standard's default): Gather already
  runs TanStack Start on the Worker, and the stateless MCP SDK transport
  (`WebStandardStreamableHTTPServerTransport`, JSON responses, POST only) fits
  in a route with no Durable Object. Same choice as Foundry.
- **A default or Current Group for agents:** rejected by Eric on 12 Nov 2026;
  a write landing in a Group nobody named is what ADR-0007 prevents.
- **The slug as the Group argument:** works, but an agent would show and pass
  household names around, and an unknown slug would have to stay distinct.
- **An idempotency column per table:** five schema changes and five indexes for
  the same rule; one personal table states it once.
- **A shared MCP package with Foundry:** out of scope for APP-43; the code is
  copied and the differences are proposed to the toolkit standard.

## Consequences

- Every Convex deployment must define `MCP_RESOURCE_URLS`, `none` where MCP is
  off, or the deploy fails. Production lists the staging and production
  endpoints, because staging runs on the production backend (ADR-0039).
- `gather:read` and `gather:write` are created in the Clerk Dashboard.
- A new create mutation an agent should reach takes `idempotencyKey` and runs
  its insert through `createOnce`.
- New code resolves identity through `lib/sharing.ts`, never
  `ctx.auth.getUserIdentity()` directly, or it skips the connected-app gate.
