# MCP Auth

Use this when an MCP server exposes non-public data or actions.

## Decision

- **Public read-only demo tools**: no auth is acceptable for local demos only.
- **User data or mutations**: require user auth and scoped permissions.
- **Organization/admin actions**: require explicit role checks.
- **Third-party account access**: use OAuth.
- **Internal company tools**: consider Cloudflare Access.

## Remote Endpoint Safety

For Streamable HTTP endpoints:

- validate `Origin` for browser-exposed endpoints
- require auth before sensitive `tools/list` metadata if tool names reveal
  sensitive system capabilities
- deny by default when identity cannot be resolved
- keep tool handlers permission-aware, not just the outer endpoint
- return structured errors without leaking secrets

## OAuth On Cloudflare

Use `@cloudflare/workers-oauth-provider` when the MCP server itself performs
OAuth. Expect to configure:

- OAuth client ID and secret
- cookie encryption secret
- callback URL for local development
- callback URL for production
- KV or other required token/session storage

Set production values with Wrangler secrets. Do not commit secrets.

## App Auth

If using app auth such as Clerk, decide how the MCP client obtains and presents
credentials. Do not assume a browser session cookie is available to a non-browser
MCP client. Document the expected token flow and test denial when the token is
missing, expired, or lacks scope.
