/**
 * Every environment variable gather reads, and who reads it.
 *
 * Data only: an entry names its Infisical key and which consumer reads it under
 * which name in which environments. The shared routing in
 * docs/standards/environments.md (scripts/lib/env/routing.mjs) picks the
 * destination, so this file holds no destination table of its own
 * (ADR-0014's rule, now owned by the toolkit).
 *
 * Gather-specific shape, all expressed through ENV_CONFIG rather than routing
 * overrides:
 * - `staging` is a frontend on the production Convex deployment (ADR-0039), so
 *   it has no `convex.deployments.staging`: no Convex variables and no deploy
 *   key reach it.
 * - The staging Worker keeps its live name `gather-stg`, which serves the
 *   `gather-stg.appelent.nl` custom domain.
 */
import type { EnvironmentEntry } from './scripts/lib/env/types.ts'

export const ENV_CONFIG = {
  appName: 'gather',
  // `/gather` overrides a same-named root value.
  source: { paths: ['/', '/gather'] },
  convex: {
    project: 'eric-jansen:gather',
    deployments: { production: 'limitless-bulldog-972' },
  },
  worker: { name: 'gather', names: { staging: 'gather-stg' } },
  mobile: { path: 'apps/mobile' },
  github: { repository: 'AppElent/gather' },
} as const

export const ENVIRONMENTS = [
  'local',
  'preview',
  'staging',
  'production',
] as const

export const ENTRIES = [
  // ---------- Clerk ----------
  {
    key: 'clerkPublishableKey',
    infisicalKey: 'clerk-publishable-key',
    description:
      'Clerk publishable key: pk_test_ locally, pk_live_ in preview, staging and production. Published by design.',
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_CLERK_PUBLISHABLE_KEY',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      'expo-build': {
        name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
        environments: ['local', 'preview', 'production'],
      },
      'expo-local': {
        name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
        environments: ['local'],
      },
    },
  },
  {
    key: 'clerkJwtIssuerDomain',
    infisicalKey: 'clerk-jwt-issuer-domain',
    description:
      'Clerk JWT issuer domain, the Clerk↔Convex auth bridge. A Convex deployment without it refuses every authenticated call.',
    secret: false,
    lands: {
      'convex-functions': {
        name: 'CLERK_JWT_ISSUER_DOMAIN',
        environments: ['local', 'preview', 'production'],
      },
    },
  },

  // ---------- Convex ----------
  {
    key: 'convexUrl',
    infisicalKey: 'convex-url',
    description:
      'Convex deployment URL the client connects to. Staging and the mobile preview app store the production URL (ADR-0039).',
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_CONVEX_URL',
        environments: ['local', 'preview', 'staging', 'production'],
        // A build that deploys a backend learns the URL from that deploy. On
        // preview there is nothing to store: Convex mints a backend per PR.
        suppliedIn: {
          preview: 'convex deploy --cmd-url-env-var-name CONVEX_URL',
          production: 'convex deploy --cmd-url-env-var-name CONVEX_URL',
        },
      },
      'expo-build': {
        name: 'EXPO_PUBLIC_CONVEX_URL',
        environments: ['local', 'preview', 'production'],
      },
      'expo-local': {
        name: 'EXPO_PUBLIC_CONVEX_URL',
        environments: ['local'],
      },
    },
  },
  {
    key: 'convexDeployment',
    infisicalKey: 'convex-deployment',
    description:
      'Which Convex deployment the local CLI talks to. Written by `convex dev`.',
    secret: false,
    lands: {
      'local-tooling': { name: 'CONVEX_DEPLOYMENT', environments: ['local'] },
    },
  },
  {
    key: 'convexDeployKey',
    infisicalKey: 'convex-deploy-key',
    description:
      'Deploy key scoping every `convex` command in CI: preview kind in Infisical staging, prod: in prod. Absent from staging by design: a merge must not change the production backend (ADR-0039).',
    secret: true,
    lands: {
      workflow: {
        name: 'CONVEX_DEPLOY_KEY',
        environments: ['preview', 'production'],
      },
    },
  },

  // ---------- Sample household ----------
  {
    key: 'sampleDataEnabled',
    infisicalKey: 'enable-sample-data',
    description:
      'Whether the Sample household can be loaded. The Convex copy gates the mutation, the Vite copy shows the panel. Never staging or production, which share a deployment.',
    secret: false,
    lands: {
      'convex-functions': {
        name: 'ENABLE_SAMPLE_DATA',
        environments: ['local', 'preview'],
      },
      'vite-build': {
        name: 'VITE_ENABLE_SAMPLE_DATA',
        environments: ['local', 'preview'],
      },
    },
  },
  {
    key: 'testUserEmail',
    infisicalKey: 'test-user-email',
    description:
      "Shared Clerk test-instance user for the sign-in page's one-click test login. Published: the build inlines it.",
    optional: true,
    secret: false,
    lands: {
      'vite-build': { name: 'VITE_TEST_USER_EMAIL', environments: ['local'] },
      'expo-local': {
        name: 'EXPO_PUBLIC_TEST_USER_EMAIL',
        environments: ['local'],
      },
    },
  },
  {
    key: 'testUserPassword',
    infisicalKey: 'test-user-password',
    description:
      'Password for that test user. Published for the same reason, so the account must never exist outside the Clerk test instance.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_TEST_USER_PASSWORD',
        environments: ['local'],
      },
      'expo-local': {
        name: 'EXPO_PUBLIC_TEST_USER_PASSWORD',
        environments: ['local'],
      },
    },
  },

  // ---------- Sentry ----------
  {
    key: 'sentryDsn',
    infisicalKey: 'sentry-dsn',
    description: 'Sentry DSN. Public by design: it only accepts events.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_DSN',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      // The phone initialises Sentry only in a release build.
      'expo-build': {
        name: 'EXPO_PUBLIC_SENTRY_DSN',
        environments: ['preview', 'production'],
      },
    },
  },
  {
    key: 'sentryOrg',
    infisicalKey: 'sentry-org',
    description: 'Sentry organisation slug, for source-map upload.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_ORG',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      // `@sentry/react-native`'s EAS build steps and the OTA publish wrapper.
      'eas-tooling': {
        name: 'SENTRY_ORG',
        environments: ['preview', 'production'],
      },
    },
  },
  {
    key: 'sentryProject',
    infisicalKey: 'sentry-project',
    description: 'Sentry project slug, for source-map upload.',
    optional: true,
    secret: false,
    lands: {
      'vite-build': {
        name: 'VITE_SENTRY_PROJECT',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      'eas-tooling': {
        name: 'SENTRY_PROJECT',
        environments: ['preview', 'production'],
      },
    },
  },
  {
    key: 'sentryAuthToken',
    infisicalKey: 'sentry-auth-token',
    description:
      'Uploads source maps and debug symbols: web builds in CI and `deploy:<environment>` (through env:exec), EAS native builds, and OTA publishes (`mobile:update:<channel>`). Never written to a local file.',
    optional: true,
    secret: true,
    lands: {
      workflow: {
        name: 'SENTRY_AUTH_TOKEN',
        environments: ['preview', 'staging', 'production'],
      },
      'eas-tooling': {
        name: 'SENTRY_AUTH_TOKEN',
        environments: ['preview', 'production'],
      },
    },
  },

  // ---------- Recipe import ----------
  {
    key: 'anthropicApiKey',
    infisicalKey: 'anthropic-api-key',
    description:
      "The recipe URL-import action's AI fallback. Optional: JSON-LD imports work without it.",
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'ANTHROPIC_API_KEY',
        environments: ['local', 'preview', 'production'],
      },
    },
  },

  // ---------- Task providers ----------
  {
    key: 'notionClientId',
    infisicalKey: 'notion-client-id',
    description:
      'Notion OAuth client ID. Public: it travels in the authorize URL.',
    optional: true,
    secret: false,
    lands: {
      'convex-functions': {
        name: 'NOTION_CLIENT_ID',
        environments: ['local', 'preview', 'production'],
      },
    },
  },
  {
    key: 'notionClientSecret',
    infisicalKey: 'notion-client-secret',
    description: 'Notion OAuth client secret.',
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'NOTION_CLIENT_SECRET',
        environments: ['local', 'preview', 'production'],
      },
    },
  },
  {
    key: 'todoistClientId',
    infisicalKey: 'todoist-client-id',
    description:
      'Todoist OAuth client ID. Public: it travels in the authorize URL.',
    optional: true,
    secret: false,
    lands: {
      'convex-functions': {
        name: 'TODOIST_CLIENT_ID',
        environments: ['local', 'preview', 'production'],
      },
    },
  },
  {
    key: 'todoistClientSecret',
    infisicalKey: 'todoist-client-secret',
    description: 'Todoist OAuth client secret.',
    optional: true,
    secret: true,
    lands: {
      'convex-functions': {
        name: 'TODOIST_CLIENT_SECRET',
        environments: ['local', 'preview', 'production'],
      },
    },
  },

  // ---------- In-app issue reporter ----------
  // A per-PR Worker starts empty, so preview.yml applies these after deploying
  // it (`env.mjs apply preview --ci --only worker`). The `workflow` landings
  // give that step their values as repository-scope PREVIEW_<name>. The owner
  // has none: GitHub reserves GITHUB_REPOSITORY_OWNER and the runner already
  // sets it to this repository's owner.
  {
    key: 'githubIssuesToken',
    infisicalKey: 'github-issues-token',
    description:
      'Fine-grained token with Issues: read and write, for the in-app issue reporter.',
    optional: true,
    secret: true,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_ISSUES_TOKEN',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      workflow: { name: 'GITHUB_ISSUES_TOKEN', environments: ['preview'] },
    },
  },
  {
    key: 'githubRepositoryOwner',
    infisicalKey: 'github-repo-owner',
    description: 'Owner of the repo the issue reporter files into.',
    optional: true,
    secret: false,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_REPOSITORY_OWNER',
        environments: ['local', 'preview', 'staging', 'production'],
      },
    },
  },
  {
    key: 'githubRepositoryName',
    infisicalKey: 'github-repo-name',
    description: 'Name of the repo the issue reporter files into.',
    optional: true,
    secret: false,
    lands: {
      'worker-runtime': {
        name: 'GITHUB_REPOSITORY_NAME',
        environments: ['local', 'preview', 'staging', 'production'],
      },
      workflow: { name: 'GITHUB_REPOSITORY_NAME', environments: ['preview'] },
    },
  },

  // ---------- CI credentials ----------
  {
    key: 'cloudflareApiToken',
    infisicalKey: 'cloudflare-account-token',
    description:
      'Cloudflare API token used by wrangler to deploy and to set Worker secrets.',
    secret: true,
    lands: {
      workflow: {
        name: 'CLOUDFLARE_API_TOKEN',
        environments: ['preview', 'staging', 'production'],
      },
    },
  },
  {
    key: 'cloudflareAccountId',
    infisicalKey: 'cloudflare-account-id',
    description:
      'Cloudflare account for Worker deploys. An identifier, not a credential: workflows read it from vars.',
    secret: false,
    lands: {
      workflow: {
        name: 'CLOUDFLARE_ACCOUNT_ID',
        environments: ['preview', 'staging', 'production'],
      },
    },
  },
] as const satisfies readonly EnvironmentEntry[]
