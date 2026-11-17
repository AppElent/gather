import { createFileRoute } from '@tanstack/react-router'
import { handleGatherMcpRequest } from '#/lib/mcp/handler'

/** The remote MCP endpoint (docs/runbooks/mcp.md). */
export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      GET: async ({ request }) => handleGatherMcpRequest(request),
      POST: async ({ request }) => handleGatherMcpRequest(request),
      DELETE: async ({ request }) => handleGatherMcpRequest(request),
      OPTIONS: async ({ request }) => handleGatherMcpRequest(request),
    },
  },
})
