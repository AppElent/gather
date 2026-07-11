---
name: add-mcp-server
description: Use when adding a Model Context Protocol (MCP) server or MCP tools to an Appelent project, especially TanStack Start apps deployed on Cloudflare Workers. Guides transport choice, dependency setup, tool design, auth, tests, MCP Inspector verification, and the skill-vs-package decision for the Appelent mcp capability.
---

# add-mcp-server

Add an MCP server as an Appelent capability. Start with this skill as the
reusable asset; create `@appelent/mcp` only when two or more projects need the
same imported runtime helpers, adapters, auth context, or test utilities.

## Responsibility Split

- **This skill**: project discovery, architecture choice, endpoint wiring,
  dependency selection, auth decisions, tests, verification, and documentation.
- **A future `@appelent/mcp` package**: shared runtime code that apps import.
  Do not create the package for one app's local pattern. Once it exists, read
  the package README and treat it as source of truth.
- **The app**: app-specific MCP tools, domain logic, permission rules, and UI
  demos.

## 1. Discover The Target

Read:

- `CLAUDE.md` and `AGENTS.md`
- `package.json`
- `wrangler.jsonc` or `wrangler.toml`
- existing MCP files: `rg -n "MCP|mcp|McpServer|createMcpHandler|registerTool|server.tool" src convex .`
- Appelent registry: `C:\Users\ericj\.claude\appelent\capabilities.json`

Identify:

- framework and routing layer
- hosting target
- whether the MCP server is local stdio or remote HTTP
- whether tools need per-session state
- whether tools need auth, user context, or scoped permissions
- whether an existing shared package already owns the runtime pattern

## 2. Choose The Shape

Prefer remote Streamable HTTP for a remotely hosted MCP server.

Use this decision tree:

- **Local-only developer tool**: use stdio.
- **Remote stateless tools**: use Streamable HTTP and a new `McpServer` instance
  per request.
- **Remote stateful tools**: use a Durable Object backed pattern, such as
  Cloudflare Agents SDK `McpAgent` or `WorkerTransport`.
- **Browser-exposed local endpoint**: validate `Origin` and bind local servers
  to localhost where applicable.
- **Authenticated tools**: add OAuth, Cloudflare Access, or app auth before
  exposing sensitive operations.

For Cloudflare Workers, prefer `createMcpHandler` from `agents/mcp` for new
remote MCP endpoints. Avoid copying old SSE examples unless a legacy client
requires them.

## 3. Add Dependencies

Use `pnpm`.

Baseline:

```bash
pnpm add @modelcontextprotocol/sdk zod
```

Cloudflare remote MCP:

```bash
pnpm add agents
```

OAuth-protected Cloudflare MCP:

```bash
pnpm add @cloudflare/workers-oauth-provider
```

After editing Worker bindings, run the project's Cloudflare typegen command.

## 4. Design Tools

MCP tools are not a one-to-one wrapper over the app API. Add a small set of
goal-oriented tools with clear names, stable schemas, and narrow permissions.

For every tool define:

- `name`: stable snake_case or lower camelCase identifier
- `title`: short human label when supported
- `description`: what the tool does, when to use it, and important constraints
- `inputSchema`: Zod schema with descriptions on meaningful fields
- permissions: public, user-scoped, admin-only, or service-only
- tests: success, validation failure, and auth denial when applicable

Keep business logic outside the route/handler where possible. The route should
construct the MCP server and attach tools; app services should do the real work.

## 5. Implement By Stack

- For TanStack Start on Cloudflare, read
  `references/tanstack-start-cloudflare.md`.
- For a standalone Cloudflare Worker, read `references/cloudflare-worker.md`.
- For auth, read `references/auth.md`.
- For tests and MCP Inspector checks, read `references/testing.md`.

If the project is not TanStack Start or Cloudflare, adapt the same transport,
auth, and test principles to the host framework.

## 6. Register The Capability

When the project now owns an MCP server, update Appelent registry files:

- add capability `mcp` with `owner: "skill"`, `skill: "add-mcp-server"`,
  `status: "active"` if it does not already exist
- add `"mcp"` to the target project's capability list
- update both global source and repo-local managed mirror when working locally

Do not mark the capability package-owned until `@appelent/mcp` exists and its
README is the source of truth.

## 7. Verify

Run the narrowest meaningful checks:

- typecheck
- unit tests for tool logic
- endpoint or handler tests for `initialize`, `tools/list`, and at least one
  `tools/call`
- auth denial tests for protected tools
- MCP Inspector or a real MCP client connection
- build if routing, Worker config, or deployment behavior changed

Document client connection instructions in the app's docs or README.
