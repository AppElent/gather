# Cloudflare Worker MCP

Use this when the MCP server is a standalone Worker or can be wired through a
standard Worker `fetch` handler.

## Stateless Remote MCP

Prefer `createMcpHandler` from `agents/mcp` and a fresh `McpServer` per request.

```ts
import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "my-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "hello",
    {
      description: "Return a greeting.",
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name ?? "World"}!` }],
    }),
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(createServer(), { route: "/mcp" })(
      request,
      env,
      ctx,
    );
  },
} satisfies ExportedHandler<Env>;
```

## Stateful Remote MCP

Use stateful infrastructure only when tools need session state, resumability,
elicitation, sampling, or server-to-client behavior.

Use a Durable Object backed approach such as Agents SDK `McpAgent` or
`WorkerTransport` storage. Add Durable Object bindings and migrations, then run
typegen.

## Worker Configuration

For `wrangler.jsonc` or `wrangler.toml`:

- keep `compatibility_date` current for the project
- add Durable Object bindings only for stateful servers
- add KV or other storage bindings only when auth/session state requires them
- never commit secret values

## Client Connection

Remote-capable clients connect to:

```text
https://<worker-host>/mcp
```

Clients that need a local proxy can use:

```bash
npx mcp-remote https://<worker-host>/mcp
```
