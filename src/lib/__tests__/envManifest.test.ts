import { describe, expect, it } from 'vitest'
import { ENTRIES, ENVIRONMENTS } from '../../../env.manifest.ts'
import { RESOLVED_MANIFEST } from '../../../scripts/env-source.mjs'
import type { EnvironmentEntry } from '../../../scripts/lib/env/types.ts'

// The routing itself is the toolkit's (docs/standards/environments.md) and is
// tested there. These tests pin what gather's data must keep true under it.
const entries = ENTRIES as readonly EnvironmentEntry[]
const byKey = (key: string) => entries.find((entry) => entry.key === key)
const placementsFor = (environment: string, prNumber = '1') =>
  RESOLVED_MANIFEST.placementsFor(environment, { prNumber })
const namesIn = (environment: string) =>
  placementsFor(environment).map((placement) => placement.name)

describe('the manifest', () => {
  it('uses only standard environment names', () => {
    expect(ENVIRONMENTS).toEqual(['local', 'preview', 'staging', 'production'])
  })

  it('is data only: the shared routing supplies consumers and placements', async () => {
    const manifest = await import('../../../env.manifest.ts')
    expect(Object.keys(manifest).sort()).toEqual([
      'ENTRIES',
      'ENVIRONMENTS',
      'ENV_CONFIG',
    ])
  })

  it('never marks a value a client bundle reads as secret', () => {
    // The build inlines it into a bundle anyone can download, and this repo is
    // public.
    for (const entry of entries) {
      for (const consumer of ['vite-build', 'expo-build', 'expo-local']) {
        if (entry.lands[consumer]) expect(entry.secret).toBe(false)
      }
    }
  })

  it('prefixes every name a client bundle reads', () => {
    for (const entry of entries) {
      const vite = entry.lands['vite-build']
      if (vite) expect(vite.name.startsWith('VITE_')).toBe(true)
      for (const consumer of ['expo-build', 'expo-local']) {
        const expo = entry.lands[consumer]
        if (expo) expect(expo.name.startsWith('EXPO_PUBLIC_')).toBe(true)
      }
    }
  })

  it('gives every logical value one unique canonical Infisical key', () => {
    const keys = entries.map((entry) => entry.infisicalKey)
    expect(keys.every(Boolean)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('claims each name at each destination exactly once', () => {
    for (const environment of ENVIRONMENTS) {
      const claimed = new Map<string, string>()
      for (const placement of placementsFor(environment)) {
        const slot = `${JSON.stringify(placement.destination)}/${placement.name}`
        const previous = claimed.get(slot)
        if (previous) expect(previous).toBe(placement.entry.key)
        claimed.set(slot, placement.entry.key)
      }
    }
  })
})

describe('GitHub scoping', () => {
  it('prefixes every repository-scope name, so preview never shadows an Environment', () => {
    const repo = placementsFor('preview').filter(
      (p) => p.destination.kind === 'github',
    )
    expect(repo.length).toBeGreaterThan(0)
    for (const placement of repo) {
      expect(placement.name).toBe(`PREVIEW_${placement.variable}`)
    }
  })

  it('never gives one name to two GitHub scopes', () => {
    const repo = new Set(
      placementsFor('preview')
        .filter((p) => p.destination.kind === 'github')
        .map((p) => p.name),
    )
    for (const environment of ['staging', 'production']) {
      for (const placement of placementsFor(environment)) {
        if (placement.destination.kind !== 'github') continue
        expect(placement.destination).toEqual({
          kind: 'github',
          scope: environment,
        })
        expect(repo.has(placement.name)).toBe(false)
      }
    }
  })
})

describe('test-user values', () => {
  it('land only locally', () => {
    for (const environment of ['preview', 'staging', 'production']) {
      expect(
        namesIn(environment).some((name) => name.includes('TEST_USER')),
      ).toBe(false)
    }
    expect(namesIn('local')).toEqual(
      expect.arrayContaining([
        'VITE_TEST_USER_EMAIL',
        'VITE_TEST_USER_PASSWORD',
        'EXPO_PUBLIC_TEST_USER_EMAIL',
        'EXPO_PUBLIC_TEST_USER_PASSWORD',
      ]),
    )
  })
})

describe('what production may not have', () => {
  it('excludes the sample household by declaration, not by omission', () => {
    // Its absence is the entire mechanism keeping fake households out of real
    // data — there is no runtime check behind it.
    expect(
      byKey('sampleDataEnabled')?.lands['convex-functions']?.environments,
    ).not.toContain('production')
    expect(namesIn('production')).not.toContain('ENABLE_SAMPLE_DATA')
    expect(namesIn('production')).not.toContain('VITE_ENABLE_SAMPLE_DATA')
  })
})

describe('what staging may not have', () => {
  // staging is a frontend on the production Convex deployment (ADR 0039).
  const staging = placementsFor('staging')

  it('excludes the sample household, like production', () => {
    expect(namesIn('staging')).not.toContain('ENABLE_SAMPLE_DATA')
    expect(namesIn('staging')).not.toContain('VITE_ENABLE_SAMPLE_DATA')
  })

  it('cannot change the production backend', () => {
    expect(namesIn('staging')).not.toContain('CONVEX_DEPLOY_KEY')
    expect(staging.some((p) => p.destination.kind === 'convex')).toBe(false)
  })

  it('stores the Convex URL, because no deploy produces it', () => {
    const url = staging.find((p) => p.name === 'VITE_CONVEX_URL')
    expect(url?.suppliedBy).toBeNull()
  })

  it('keeps the live gather-stg Worker', () => {
    const worker = staging.find((p) => p.destination.kind === 'worker')
    expect(worker?.destination).toEqual({
      kind: 'worker',
      worker: 'gather-stg',
    })
  })
})

describe('auth follows lifetime', () => {
  const clerk = (environment: string) =>
    placementsFor(environment)
      .filter((p) => p.name.includes('CLERK'))
      .map((p) => `${p.consumer} ${p.entry.infisicalKey}`)

  // The tier decides the instance: Infisical staging holds the development
  // key and issuer, Infisical prod the production ones (environments.md).
  it('gives short-lived web previews the regular Clerk entries', () => {
    expect(clerk('preview')).toEqual([
      'vite-build clerk-publishable-key',
      'convex-functions clerk-jwt-issuer-domain',
    ])
  })

  it('gives staging web and the installed preview app the production tier', () => {
    // Staging web serves gather-stg.appelent.nl, a host the production
    // instance accepts. EAS preview is written from staging.
    expect(clerk('staging')).toEqual([
      'vite-build clerk-publishable-key',
      'expo-build clerk-publishable-key',
    ])
  })
})

describe('values the deploy produces', () => {
  it('marks the deployed Convex URL as supplied rather than missing', () => {
    // Convex mints a backend per PR, so on preview there is no value anyone
    // could have stored.
    for (const environment of ['preview', 'production']) {
      const supplied = placementsFor(environment).find((p) =>
        p.name.endsWith('VITE_CONVEX_URL'),
      )
      expect(supplied?.suppliedBy).toContain('convex deploy')
    }
  })

  it('stores it locally, where no deploy exists to produce it', () => {
    const local = placementsFor('local').find(
      (p) => p.name === 'VITE_CONVEX_URL',
    )
    expect(local?.suppliedBy).toBeNull()
    expect(local?.destination).toEqual({ kind: 'file', path: '.env.local' })
  })
})

describe('the issue reporter', () => {
  it('lands on every Worker, including the per-PR one', () => {
    const workers: Record<string, string> = {}
    for (const environment of ENVIRONMENTS) {
      const destination = placementsFor(environment, '7').find(
        (p) =>
          p.entry.key === 'githubIssuesToken' &&
          p.consumer === 'worker-runtime',
      )?.destination
      workers[environment] =
        destination?.kind === 'worker'
          ? destination.worker
          : String(destination?.kind)
    }
    expect(workers).toEqual({
      local: 'file',
      preview: 'gather-pr-7',
      staging: 'gather-stg',
      production: 'gather',
    })
  })

  it('reaches the preview workflow, which applies it to the per-PR Worker', () => {
    const names = namesIn('preview')
    expect(names).toContain('PREVIEW_GITHUB_ISSUES_TOKEN')
    expect(names).toContain('PREVIEW_GITHUB_REPOSITORY_NAME')
  })
})

describe('mobile', () => {
  it('routes mobile values to the local file and EAS environments', () => {
    const destinations = (environment: string) =>
      placementsFor(environment)
        .filter((p) => p.name === 'EXPO_PUBLIC_CONVEX_URL')
        .map((p) => p.destination)
    expect(destinations('local')).toEqual(
      expect.arrayContaining([
        { kind: 'eas', environment: 'development' },
        { kind: 'file', path: 'apps/mobile/.env.local' },
      ]),
    )
    // The installed preview app is long-lived, so EAS preview is written
    // from staging, never from short-lived web previews.
    expect(destinations('preview')).toEqual([])
    expect(destinations('staging')).toEqual([
      { kind: 'eas', environment: 'preview' },
    ])
    expect(destinations('production')).toEqual([
      { kind: 'eas', environment: 'production' },
    ])
  })
})
