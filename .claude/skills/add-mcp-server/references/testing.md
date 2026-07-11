# MCP Testing

Use this after adding or changing MCP tools, transport, or auth.

## Unit Tests

Test app services separately from MCP transport:

- success path
- validation edge cases
- permission checks
- stable result shape

## Protocol Tests

Exercise the MCP endpoint or handler with JSON-RPC messages:

- `initialize`
- `tools/list`
- `tools/call` for at least one tool
- invalid tool name
- invalid arguments
- auth denial when protected

Keep these tests close to the MCP server factory or route.

## Manual Verification

Use MCP Inspector for local verification:

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect to the local or remote `/mcp` endpoint, list tools, and call each new
tool at least once with realistic arguments.

## Client Documentation

Add connection notes to the app docs or README:

- endpoint URL
- auth requirements
- local proxy command when needed
- known limitations

Example proxy command:

```bash
npx mcp-remote https://<host>/mcp
```
