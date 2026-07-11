# TanStack Start On Cloudflare

Use this when adding MCP to a TanStack Start app deployed to Cloudflare Workers.

## Existing Demo Pattern To Avoid Copying Blindly

Some scaffolded apps may contain:

- a file route such as `src/routes/mcp.ts`
- a custom `handleMcpRequest()`
- `InMemoryTransport.createLinkedPair()`
- a module-global `McpServer`

This proves the idea but is not the preferred production shape for remote MCP.
Modern MCP remote servers should use Streamable HTTP. For stateless servers,
create a fresh `McpServer` per request so state and response data do not leak
between clients.

## Recommended Shape

Create a small factory:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMcpServer() {
  const server = new McpServer({
    name: "app-name",
    version: "1.0.0",
  });

  server.registerTool(
    "example_tool",
    {
      title: "Example tool",
      description: "Explain what goal this tool accomplishes.",
      inputSchema: {
        value: z.string().describe("The value to process."),
      },
    },
    async ({ value }) => ({
      content: [{ type: "text", text: value }],
    }),
  );

  return server;
}
```

Then wire the route using the host-compatible Streamable HTTP handler. On
Cloudflare Workers, prefer `createMcpHandler` from `agents/mcp` where the
framework entrypoint allows a standard Worker `fetch` handler.

If TanStack Start file routes make direct `createMcpHandler` integration
awkward, keep the adapter thin and preserve the same rule: construct a server
per request, validate auth/origin, pass through protocol responses, and test the
full JSON-RPC flow.

## Files To Consider

- `src/lib/mcp/server.ts`: server factory and tool registration
- `src/lib/mcp/tools/*.ts`: tool-specific wrappers around app services
- `src/routes/mcp.ts`: route/handler only
- `src/lib/mcp/__tests__/*.test.ts`: tool and handler tests

## Project Notes

- Do not use filesystem JSON persistence for production Worker-hosted tools.
  Use Convex, D1, KV, R2, or another project-approved data layer.
- Keep route-generated code compatible with TanStack route generation.
- Run route generation if adding/removing file routes requires it.
- Run Cloudflare typegen when Worker bindings change.
