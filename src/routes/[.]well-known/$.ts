import { createFileRoute } from '@tanstack/react-router'
import { handleWellKnownRequest } from '#/lib/mcp/wellKnown'

/** OAuth discovery for the MCP endpoint (docs/runbooks/mcp.md). */
export const Route = createFileRoute('/.well-known/$')({
  server: {
    handlers: {
      GET: async ({ request }) => handleWellKnownRequest(request),
      OPTIONS: async ({ request }) => handleWellKnownRequest(request),
    },
  },
})
