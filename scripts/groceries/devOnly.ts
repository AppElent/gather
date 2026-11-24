// The guard of ask-ai.ts (APP-751): `convex run` uses whichever deployment is
// selected, so the script checks which one that is and refuses anything but a
// dev deployment before it asks the model a single question.

/** The value of `CONVEX_DEPLOYMENT` in an env file, without its comment. */
export function deploymentFromEnvFile(text: string): string | null {
  const match = text.match(/^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*=\s*(.*)$/m)
  const value = match?.[1]?.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')
  return value || null
}

/**
 * The deployment `convex run` would use, from the same places the CLI looks:
 * a deploy key (which names its deployment before the `|`), then the
 * `CONVEX_DEPLOYMENT` variable, then `CONVEX_DEPLOYMENT` in `.env.local`.
 * Throws unless it is a `dev:` deployment, and when it cannot tell.
 */
export function assertDevDeployment(
  env: Record<string, string | undefined>,
  envLocal: string | null,
): string {
  const key = env.CONVEX_DEPLOY_KEY?.split('|')[0]
  const selected =
    key || env.CONVEX_DEPLOYMENT || (envLocal ? deploymentFromEnvFile(envLocal) : null)
  if (!selected)
    throw new Error(
      'cannot tell which Convex deployment is selected; set CONVEX_DEPLOYMENT=dev:<name>',
    )
  if (!selected.startsWith('dev:'))
    throw new Error(
      `refusing to ask the model through "${selected}": this script only ever runs against a dev deployment`,
    )
  return selected
}
