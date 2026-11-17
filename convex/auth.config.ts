const clerkIssuer = process.env.CLERK_JWT_ISSUER_DOMAIN?.replace(/\/$/, '')

/**
 * Clerk OAuth access tokens minted for the MCP endpoint (docs/runbooks/mcp.md,
 * ADR-0046). Each listed MCP resource URL is a token audience; a token for
 * another resource, or for another app on the shared Clerk instance, is
 * refused. Convex requires the variable on every deployment, so a deployment
 * that serves no MCP endpoint sets `none`.
 */
const mcpResourceUrls = (process.env.MCP_RESOURCE_URLS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter((url) => /^https?:\/\/[^/]+\/mcp$/.test(url))

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
    ...(clerkIssuer
      ? mcpResourceUrls.map((resource) => ({
          type: 'customJwt' as const,
          issuer: clerkIssuer,
          jwks: `${clerkIssuer}/.well-known/jwks.json`,
          algorithm: 'RS256' as const,
          applicationID: resource,
        }))
      : []),
  ],
}
