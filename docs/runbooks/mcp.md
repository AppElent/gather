---
type: runbook
description: Read when connecting to, operating, or changing the Gather MCP server.
version: 1.3.0
---

# Gather MCP

Gather serves a remote MCP server at `/mcp` from the same Worker as the web app.
A Member connects Claude, ChatGPT, or another MCP client and reads and writes
recipes, task lists, notes, and calendars in their Groups. The design is in
[ADR-0046](../adr/0046-agents-connect-through-clerk-oauth-and-name-the-group.md);
the code is copied from Foundry's (`AppElent/workouts`, `src/lib/mcp/`).

| Environment | Endpoint | Convex deployment | Clerk issuer |
| --- | --- | --- | --- |
| Production | `https://gather.appelent.nl/mcp` | production | production instance |
| Staging | `https://gather-stg.appelent.nl/mcp` | production (ADR-0039) | production instance |
| Dev Worker | `https://gather-dev.<account>.workers.dev/mcp` | dev | development instance |
| Local | `http://localhost:3000/mcp` | dev | development instance |

PR preview Workers have no MCP: their URLs change per PR.

## Connect

- **Claude.ai, Desktop, mobile:** Settings → Connectors → Add custom connector,
  paste the endpoint, then sign in to Gather.
- **Claude Code:** `claude mcp add --transport http gather https://gather.appelent.nl/mcp`,
  then run `/mcp` and choose Authenticate.
- **ChatGPT and others:** add the endpoint as a remote MCP server with OAuth.

The endpoint answers an unauthenticated request with `401` and
`WWW-Authenticate: Bearer resource_metadata=…`; the metadata names Clerk as the
authorization server, and the client registers (CIMD) and signs in with PKCE.

## How a request is authorized

1. The client sends `Authorization: Bearer <Clerk OAuth access token>`.
2. The Worker verifies the JWT against Clerk's JWKS: issuer (from
   `VITE_CLERK_PUBLISHABLE_KEY`), RS256, and `aud` exactly equal to this
   endpoint's URL.
3. The token's `scope` decides which tools exist: `gather:read` lists the read
   tools, `gather:write` lists all of them. A token with neither gets
   `403 insufficient_scope`.
4. Tools call Convex with the same token through a `customJwt` provider whose
   `applicationID` is the endpoint URL (`convex/auth.config.ts`), so the Clerk
   user is the caller and the usual Group checks apply.
5. Convex checks the scopes again (`convex/lib/connectedApps.ts`), because a
   client could call it directly: without `gather:write`, mutations and actions
   refuse an OAuth identity. Account deletion, Group deletion, role changes,
   leaving or joining a Group, and the invite code refuse every OAuth identity.

Browser `Origin`s are limited to claude.ai, claude.com, chatgpt.com, the app's
own origin, and localhost against a local server. Server-side clients send none.

## Tools

Read (`gather:read`): `get_current_user`, `list_groups`, `list_recipes`,
`get_recipe`, `list_meal_plan`, `list_task_lists`, `list_tasks`, `list_notes`,
`list_calendars`, `list_events`, and the view tools `show_week_agenda`, `show_task_list`, and
`show_recipe` (see [Views](#views)).

Write (`gather:write`): `create_recipe`, `update_recipe`, `plan_meal`,
`create_task_list`,
`create_task`, `update_task`, `create_note`, `update_note`, `create_event`,
`update_event`.

Rules for every tool:

- Every Group-scoped tool takes a `groupId` from `list_groups`. A Group the
  caller is not in reads as `Group not found`, the same as a missing one.
- Create tools require an `idempotencyKey`. Convex stores it per person in
  `idempotencyKeys`; a retry with the same key returns the first row.
  `plan_meal` counts as a create: a retry with its key answers the first
  meal instead of finding the slot taken.
- `list_notes` answers one page, with `nextCursor` while there is more; pass it
  back as `cursor`. With a `query` it searches in Convex (`searchNotes`: whole
  words, the last one from its start) and answers the best matches and `total`;
  a query shorter than two characters is refused with a message, not answered
  with no notes.
- There are no delete tools. People delete in the app.
- Recipes shared into a Group can be read there but changed only from their
  home Group. Task lists that live in Notion or Todoist are listed but their
  tasks are not readable here.
- Results are JSON in `structuredContent` and as text, without internal user
  ids, storage ids, or other Groups' ids. Errors show Gather's own refusals
  only; anything else becomes "The Gather tool failed." and goes to Sentry.

To add a tool, add it to a file in `src/lib/mcp/tools/` with `defineTool`, set
`access`, and add a case to `src/lib/mcp/handler.test.ts`. A create tool needs
its Convex mutation to take `idempotencyKey` and insert through `createOnce`
(`convex/lib/idempotency.ts`).

## Views

Three read tools open an interactive view (an [MCP App](https://modelcontextprotocol.io/extensions/apps/overview))
in hosts that support it, such as Claude.ai. Other clients get the same data as
JSON and text. The pattern is Foundry's (`AppElent/workouts`
`docs/runbooks/mcp.md#views`).

| Tool | View | What it does |
| --- | --- | --- |
| `show_week_agenda` | `ui://gather/week-agenda` | A Group's events for one Monday-to-Sunday week, every calendar; previous/next week call the tool again. |
| `show_task_list` | `ui://gather/task-list` | One task list. With `gather:write` and a list kept in Gather, the view checks tasks off (`update_task`) and adds tasks (`create_task`, with an `idempotencyKey` made in the view and reused on retry). |
| `show_recipe` | `ui://gather/recipe-card` | One recipe with photo, ingredients and steps; a servings stepper scales leading quantities in the ingredient lines. |

- The UI is React in `src/lib/mcp/views/ui/`. The Vite plugin
  `src/lib/mcp/views/vitePlugin.ts` builds it into one HTML file with inlined JS
  and CSS, exposed to the Worker as `virtual:gather-mcp-views`; `pnpm build`
  fails if it does not build.
- Copy is in `packages/core/src/messages/*/mcpViews.ts` and follows the host's
  locale (English or Dutch). Colours use the host's style variables first and
  fall back to Gather's sea and lagoon palette, light and dark.
- The recipe view loads its photo from Convex file storage, so that resource
  declares the Convex origin in `_meta.ui.csp.resourceDomains`; the others load
  nothing.
- `_meta.ui.domain` is Claude's sandbox origin for this endpoint, computed per
  request, so each environment gets its own.

## Setup per environment

**Clerk** (one instance per environment, shared with the other AppElent apps):

- OAuth applications → Scopes: add `gather:read` and `gather:write`. Creating
  scopes is Dashboard-only.
- Add both scopes to every CIMD client already saved under OAuth applications,
  above all Claude's (created when Foundry was connected). Clerk grants a CIMD
  client only the scopes saved on it, so without this the connect fails.
- An MCP resource for each endpoint URL (Clerk MCP `configure_mcp_server`, or
  the Dashboard). JWT access tokens, PKCE and the audience claim are already on
  for Foundry; check them, and that CIMD is published (the Clerk issuer's
  `/.well-known/oauth-authorization-server` shows
  `client_id_metadata_document_supported: true`).
- Foundry's runbook (`AppElent/workouts` `docs/runbooks/mcp.md`) has the
  troubleshooting for Clerk's OAuth settings and DNS.

**Convex:** `MCP_RESOURCE_URLS` (Infisical `mcp-resource-urls`) is a
comma-separated list of endpoint URLs. Convex requires it on every deployment,
so a deployment without MCP uses `none`. Apply it with
`pnpm env:apply <environment> --only convex` **before** pushing functions, or
the push fails.

| Infisical env | Value |
| --- | --- |
| dev (local) | `http://localhost:3000/mcp,https://gather-dev.<account>.workers.dev/mcp` |
| preview | `none` |
| prod | `https://gather.appelent.nl/mcp,https://gather-stg.appelent.nl/mcp` |

## Verify

1. `curl -i -X POST <endpoint>`: expect `401` with `resource_metadata`.
2. `curl <origin>/.well-known/oauth-protected-resource/mcp`: expect `resource`
   equal to the endpoint and both Gather scopes in `scopes_supported`.
3. Connect Claude.ai to staging, ask "Which Gather groups am I in?", then call
   each tool with realistic input.

## Troubleshooting

- **`401 invalid_token`:** the token's `aud` is not this endpoint. Check the
  Clerk MCP resource and that the client sent `resource`.
- **`403 insufficient_scope`:** the token has neither Gather scope. Clerk grants
  a CIMD client only the scopes saved on it; give it both and reconnect.
- **Claude.ai: "Authorization with Gather failed" right after sign-in:**
  Clerk refused `gather:*` with `invalid_scope`, because Claude's CIMD client
  was saved before the Gather scopes existed (the Clerk instance is shared with
  Foundry). Add `gather:read` and `gather:write` to that client under OAuth
  applications, then reconnect. The `error=` on the last
  `claude.ai/api/mcp/auth_callback` URL in browser history confirms it.
- **Tools fail with "Not authenticated":** Convex does not trust the token.
  Check that `MCP_RESOURCE_URLS` on that deployment lists the endpoint exactly.
- **`list_groups` is empty:** the person has never opened Gather, so there is
  no `users` row yet. `get_current_user` shows `hasGatherAccount: false`.
