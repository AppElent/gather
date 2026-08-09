/**
 * Every environment variable gather needs, and who reads it.
 *
 * An entry declares its **consumer** — who reads the value — never its
 * destination. `destinationFor()` below derives the destination from
 * (consumer, environment). That table is the knowledge this file exists to
 * hold: before it, every place a variable had to be written was re-derived
 * from memory, and the wrong answers are still visible in git history.
 *
 * See docs/adr/0014-a-variable-declares-its-consumer-not-its-destination.md
 */

export const ENVIRONMENTS = ['local', 'preview', 'stg', 'production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * Who reads a value. Two pairs look redundant and are not:
 *
 * - `vite-build` is inlined into the client bundle and is therefore public.
 *   `build-tooling` is read by the build and never inlined (it has no `VITE_`
 *   prefix), so it may be secret. Same destinations, opposite secrecy rules.
 * - `local-tooling` is read by a CLI on a developer's machine and has no
 *   remote destination at all.
 */
export const CONSUMERS = [
  'vite-build',
  'build-tooling',
  'local-tooling',
  'worker-runtime',
  'convex-functions',
  'workflow',
] as const
export type Consumer = (typeof CONSUMERS)[number]

export type Destination =
  | { kind: 'file'; path: string }
  | {
      kind: 'convex'
      target: 'dev' | 'preview-default' | 'staging' | 'production'
    }
  | { kind: 'worker'; worker: string }
  | { kind: 'github'; scope: 'repo' | 'stg' | 'production' }

/**
 * A repo-scoped GitHub name is prefixed, an environment-scoped one is not.
 *
 * This is a safety rule, not a style: an environment secret silently shadows a
 * repo secret of the same name, so if `production`'s copy were ever missing,
 * an unprefixed name would fall back to preview's value and deploy the wrong
 * thing while reporting success — the trap ADR-0013 flags as invisible in the
 * file. Different names make the fallback impossible rather than detectable.
 */
export const REPO_SCOPE_PREFIX = 'PREVIEW_'

export function githubName(name: string, scope: 'repo' | 'stg' | 'production') {
  return scope === 'repo' ? `${REPO_SCOPE_PREFIX}${name}` : name
}

/**
 * Where a consumer reads its environment from, per environment. `null` means
 * the consumer does not exist there — not that we forgot it.
 *
 * `preview`'s Worker is per-PR, so it needs the PR number; callers that touch
 * a preview Worker must pass one.
 */
export function destinationFor(
  consumer: Consumer,
  environment: Environment,
  context: { prNumber?: string } = {},
): Destination | null {
  switch (consumer) {
    // Inlined into the bundle at build time. Locally the build reads a file;
    // everywhere else the build runs in CI and reads the job env.
    case 'vite-build':
    case 'build-tooling':
      switch (environment) {
        case 'local':
          return { kind: 'file', path: '.env.local' }
        case 'preview':
          return { kind: 'github', scope: 'repo' }
        case 'stg':
          return { kind: 'github', scope: 'stg' }
        case 'production':
          return { kind: 'github', scope: 'production' }
      }
      break

    // A CLI on somebody's machine. There is nowhere remote to put it.
    case 'local-tooling':
      return environment === 'local'
        ? { kind: 'file', path: '.env.local' }
        : null

    // Read at request time by a server function on the Worker.
    case 'worker-runtime':
      switch (environment) {
        case 'local':
          return { kind: 'file', path: '.dev.vars' }
        case 'preview':
          return context.prNumber
            ? { kind: 'worker', worker: `gather-pr-${context.prNumber}` }
            : null
        case 'stg':
          return { kind: 'worker', worker: 'gather-stg' }
        case 'production':
          return { kind: 'worker', worker: 'gather' }
      }
      break

    // Read by a Convex function. Locally that is the developer's own `convex
    // dev` deployment — every developer has a different one.
    case 'convex-functions':
      switch (environment) {
        case 'local':
          return { kind: 'convex', target: 'dev' }
        case 'preview':
          return { kind: 'convex', target: 'preview-default' }
        case 'stg':
          return { kind: 'convex', target: 'staging' }
        case 'production':
          return { kind: 'convex', target: 'production' }
      }
      break

    // Read by the workflow itself, to authenticate to something.
    case 'workflow':
      switch (environment) {
        case 'local':
          return null
        case 'preview':
          return { kind: 'github', scope: 'repo' }
        case 'stg':
          return { kind: 'github', scope: 'stg' }
        case 'production':
          return { kind: 'github', scope: 'production' }
      }
  }
  return null
}

type Landing = {
  /** The variable's name as this consumer reads it. */
  name: string
  /** The environments this consumer needs it in. Absent means absent by design. */
  environments: readonly Environment[]
  /**
   * Environments where the deploy produces the value rather than a file
   * holding it. The value maps to a note on what produces it. `check` verifies
   * the wiring exists; it can never verify the value.
   */
  suppliedIn?: Partial<Record<Environment, string>>
}

/**
 * Vite only exposes prefixed variables to the bundle, so a `vite-build` landing
 * whose name lacks the prefix is silently never delivered — the app boots and
 * reads `undefined`. Requiring the prefix in the type turns that into a compile
 * error, and lets `src/env.ts` derive its client schema without a cast.
 */
type ViteLanding = Landing & { name: `VITE_${string}` }

type Lands = Partial<Record<Exclude<Consumer, 'vite-build'>, Landing>> & {
  'vite-build'?: ViteLanding
}

type BaseEntry = {
  /** Stable identity of the logical value, independent of any variable name. */
  key: string
  description: string
  /** `check` reports a missing optional value without failing. */
  optional?: true
  lands: Lands
}

/**
 * A value the Vite build reads cannot be secret — the build inlines it into a
 * bundle anyone can download, so calling it confidential is a false claim, and
 * this repo is public. The type makes that a compile error rather than a
 * comment. (`build-tooling` is the escape hatch for a build-time value that is
 * genuinely never inlined.)
 */
export type Entry =
  | (BaseEntry & { secret: false })
  | (BaseEntry & {
      secret: true
      lands: Omit<Lands, 'vite-build'> & { 'vite-build'?: never }
    })

export const ENTRIES = [
  // ---------- Clerk ----------
  {
    key: 'clerkPublishableKey',
    description:
      'Clerk publishable key. Published by design; `pk_test_…` everywhere but production.',
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_CLERK_PUBLISHABLE_KEY',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'clerkJwtIssuerDomain',
    description:
      'Clerk JWT issuer domain, the Clerk↔Convex auth bridge. A Convex deployment without it refuses every authenticated call.',
    secret: false,
    lands: {
      'convex-functions': {
        name: 'CLERK_JWT_ISSUER_DOMAIN',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },

  // ---------- Convex ----------
  {
    key: 'convexUrl',
    description: 'Convex deployment URL the client connects to.',
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_CONVEX_URL',
        environments: ['local', 'preview', 'stg', 'production'],
        // Every deployed build learns the URL from the deploy it just did,
        // via `convex deploy --cmd-url-env-var-name CONVEX_URL`. There is no
        // value to store, and on preview there could not be — Convex mints a
        // backend per PR.
        suppliedIn: {
          preview: 'convex deploy --cmd-url-env-var-name CONVEX_URL',
          stg: 'convex deploy --cmd-url-env-var-name CONVEX_URL',
          production: 'convex deploy --cmd-url-env-var-name CONVEX_URL',
        },
      },
    },
  },
  {
    key: 'convexDeployment',
    description:
      'Which Convex deployment the local CLI talks to. Written by `convex dev`; differs per developer.',
    secret: false,
    lands: {
      'local-tooling': { name: 'CONVEX_DEPLOYMENT', environments: ['local'] },
    },
  },
  {
    key: 'convexDeployKey',
    description:
      'Deploy key scoping every `convex` command in CI to one deployment. Its prefix (`preview:` / `prod:`) picks the target.',
    secret: true,
    lands: {
      workflow: {
        name: 'CONVEX_DEPLOY_KEY',
        environments: ['preview', 'stg', 'production'],
      },
    },
  },

  // ---------- Sample household ----------
  {
    key: 'sampleDataEnabled',
    description:
      'Whether the Sample household can be loaded. Two names, one decision: the Convex copy gates the mutation, the Vite copy shows the panel. Never production — its absence there is what keeps fake households out of real data.',
    secret: false,
    lands: {
      'convex-functions': {
        name: 'ENABLE_SAMPLE_DATA',
        environments: ['local', 'preview', 'stg'],
      },
      'vite-build': {
        name: 'VITE_ENABLE_SAMPLE_DATA',
        environments: ['local', 'preview', 'stg'],
      },
    },
  },
  {
    key: 'testUserEmail',
    description:
      "Shared Clerk test-instance user for @appelent/auth's one-click login. Published, not secret: the build inlines it into a bundle served at a public URL.",
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_TEST_USER_EMAIL',
        environments: ['local', 'preview', 'stg'],
      },
    },
  },
  {
    key: 'testUserPassword',
    description:
      'Password for that test user. Published for the same reason, which is why the account must never exist outside the Clerk test instance.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_TEST_USER_PASSWORD',
        environments: ['local', 'preview', 'stg'],
      },
    },
  },

  // ---------- Sentry ----------
  {
    key: 'sentryDsn',
    description:
      'Sentry DSN. A DSN is public by design — it only accepts events.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_DSN',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'sentryOrg',
    description: 'Sentry organisation slug, for source-map upload.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_ORG',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'sentryProject',
    description: 'Sentry project slug, for source-map upload.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_PROJECT',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'sentryAuthToken',
    description:
      'Uploads source maps at build time. Build-time but never inlined — it has no VITE_ prefix, which is the whole reason `build-tooling` exists as a separate consumer.',
    optional: true,
    secret: true,
    lands: {
      'build-tooling': {
        name: 'SENTRY_AUTH_TOKEN',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },

  // ---------- Recipe import ----------
  {
    key: 'anthropicApiKey',
    description:
      "The recipe URL-import action's AI fallback. Optional: JSON-LD imports work without it, and a page with no matching JSON-LD simply fails to import.",
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'ANTHROPIC_API_KEY',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },

  // ---------- Task providers ----------
  {
    key: 'notionClientId',
    description:
      'Notion OAuth client ID. Public — it travels in the authorize URL.',
    optional: true,
    secret: false,
    lands: {
      'convex-functions': {
        name: 'NOTION_CLIENT_ID',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'notionClientSecret',
    description: 'Notion OAuth client secret.',
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'NOTION_CLIENT_SECRET',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'todoistClientId',
    description:
      'Todoist OAuth client ID. Public — it travels in the authorize URL.',
    optional: true,
    secret: false,
    lands: {
      'convex-functions': {
        name: 'TODOIST_CLIENT_ID',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'todoistClientSecret',
    description: 'Todoist OAuth client secret.',
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'TODOIST_CLIENT_SECRET',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },

  // ---------- In-app issue reporter ----------
  // These three were set on production only, because nothing declared that the
  // preview and dev Workers needed them too. The reporter answered "not
  // configured" everywhere else, and no test could notice.
  {
    key: 'githubIssuesToken',
    description:
      'Fine-grained token with Issues: read and write, for the in-app issue reporter.',
    optional: true,
    secret: true,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_ISSUES_TOKEN',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'githubRepositoryOwner',
    description: 'Owner of the repo the issue reporter files into.',
    optional: true,
    secret: false,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_REPOSITORY_OWNER',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'githubRepositoryName',
    description: 'Name of the repo the issue reporter files into.',
    optional: true,
    secret: false,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_REPOSITORY_NAME',
        environments: ['local', 'preview', 'stg', 'production'],
      },
    },
  },

  // ---------- CI credentials ----------
  {
    key: 'cloudflareApiToken',
    description:
      'Cloudflare API token used by wrangler to deploy and to set Worker secrets.',
    secret: true,
    lands: {
      workflow: {
        name: 'CLOUDFLARE_API_TOKEN',
        environments: ['preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'cloudflareAccountId',
    description:
      'Cloudflare account ID. An identifier rather than a credential, but kept secret so it stays out of the public workflow logs this repo produces.',
    secret: true,
    lands: {
      workflow: {
        name: 'CLOUDFLARE_ACCOUNT_ID',
        environments: ['preview', 'stg', 'production'],
      },
    },
  },
  {
    key: 'nodeAuthToken',
    description:
      'read:packages token for the private @appelent/* GitHub Packages scope. Optional: the workflows fall back to GITHUB_TOKEN.',
    optional: true,
    secret: true,
    lands: {
      workflow: {
        name: 'NODE_AUTH_TOKEN',
        environments: ['preview', 'stg', 'production'],
      },
    },
  },
] as const satisfies readonly Entry[]

export type EntryKey = (typeof ENTRIES)[number]['key']

/** One variable, in one place, in one environment — what check and apply act on. */
export type Placement = {
  entry: Entry
  consumer: Consumer
  environment: Environment
  /** The name at this destination, already scope-prefixed where that applies. */
  name: string
  destination: Destination
  /** Non-null when the deploy produces the value: nothing to store, nothing to write. */
  suppliedBy: string | null
}

/** Every placement for an environment, in manifest order. */
export function placementsFor(
  environment: Environment,
  context: { prNumber?: string } = {},
): Placement[] {
  const placements: Placement[] = []
  for (const entry of ENTRIES as readonly Entry[]) {
    for (const consumer of CONSUMERS) {
      const landing = entry.lands[consumer]
      if (!landing || !landing.environments.includes(environment)) continue
      const destination = destinationFor(consumer, environment, context)
      if (!destination) continue
      placements.push({
        entry,
        consumer,
        environment,
        name:
          destination.kind === 'github'
            ? githubName(landing.name, destination.scope)
            : landing.name,
        destination,
        suppliedBy: landing.suppliedIn?.[environment] ?? null,
      })
    }
  }
  return placements
}
