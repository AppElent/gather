import { describe, expect, it } from 'vitest'
import {
  CONSUMERS,
  destinationFor,
  ENTRIES,
  ENVIRONMENTS,
  type Entry,
  githubName,
  placementsFor,
  REPO_SCOPE_PREFIX,
} from '../../../env.manifest.ts'

const entries = ENTRIES as readonly Entry[]
const byKey = (key: string) => entries.find((entry) => entry.key === key)

describe('the destination table', () => {
  it('answers for every consumer in every environment', () => {
    // A missing cell is the bug this whole file exists to prevent, so the table
    // must be total: every pair either resolves or says "not here" deliberately.
    for (const consumer of CONSUMERS) {
      for (const environment of ENVIRONMENTS) {
        expect(() =>
          destinationFor(consumer, environment, { prNumber: '1' }),
        ).not.toThrow()
      }
    }
  })

  it('has no remote destination for a local-only consumer', () => {
    expect(destinationFor('local-tooling', 'local')).toEqual({
      kind: 'file',
      path: '.env.local',
    })
    for (const environment of ['preview', 'stg', 'production'] as const) {
      expect(destinationFor('local-tooling', environment)).toBeNull()
    }
    expect(destinationFor('workflow', 'local')).toBeNull()
  })

  it('names the per-PR Worker from the PR number, and refuses without one', () => {
    expect(
      destinationFor('worker-runtime', 'preview', { prNumber: '42' }),
    ).toEqual({
      kind: 'worker',
      worker: 'gather-pr-42',
    })
    expect(destinationFor('worker-runtime', 'preview')).toBeNull()
  })

  it('sends deployed builds to GitHub and local ones to a file', () => {
    expect(destinationFor('vite-build', 'local')).toEqual({
      kind: 'file',
      path: '.env.local',
    })
    expect(destinationFor('vite-build', 'stg')).toEqual({
      kind: 'github',
      scope: 'stg',
    })
    expect(destinationFor('vite-build', 'preview')).toEqual({
      kind: 'github',
      scope: 'repo',
    })
  })
})

describe('GitHub scoping', () => {
  it('prefixes repo scope and leaves environment scope alone', () => {
    // Distinct names are what stop an environment secret shadowing a repo one:
    // a missing production value must fail, not quietly resolve to preview's.
    expect(githubName('CONVEX_DEPLOY_KEY', 'repo')).toBe(
      `${REPO_SCOPE_PREFIX}CONVEX_DEPLOY_KEY`,
    )
    expect(githubName('CONVEX_DEPLOY_KEY', 'stg')).toBe('CONVEX_DEPLOY_KEY')
    expect(githubName('CONVEX_DEPLOY_KEY', 'production')).toBe(
      'CONVEX_DEPLOY_KEY',
    )
  })

  it('never gives one name to two GitHub scopes', () => {
    const repo = new Set(
      placementsFor('preview', { prNumber: '1' })
        .filter((p) => p.destination.kind === 'github')
        .map((p) => p.name),
    )
    for (const environment of ['stg', 'production'] as const) {
      for (const placement of placementsFor(environment)) {
        if (placement.destination.kind !== 'github') continue
        expect(repo.has(placement.name)).toBe(false)
      }
    }
  })
})

describe('the manifest', () => {
  it('never marks a value the Vite build reads as secret', () => {
    // The build inlines it into a bundle anyone can download, and this repo is
    // public. The type forbids this; the test covers a manifest edited as JS.
    for (const entry of entries) {
      if (entry.lands['vite-build']) expect(entry.secret).toBe(false)
    }
  })

  it('prefixes every name the Vite build reads', () => {
    for (const entry of entries) {
      const landing = entry.lands['vite-build']
      if (landing) expect(landing.name.startsWith('VITE_')).toBe(true)
    }
  })

  it('gives every entry somewhere to land', () => {
    for (const entry of entries) {
      expect(Object.keys(entry.lands).length).toBeGreaterThan(0)
      for (const landing of Object.values(entry.lands)) {
        expect(landing.environments.length).toBeGreaterThan(0)
      }
    }
  })

  it('claims each name at each destination exactly once', () => {
    for (const environment of ENVIRONMENTS) {
      const claimed = new Map<string, string>()
      for (const placement of placementsFor(environment, { prNumber: '1' })) {
        const slot = `${JSON.stringify(placement.destination)}/${placement.name}`
        const previous = claimed.get(slot)
        if (previous) expect(previous).toBe(placement.entry.key)
        claimed.set(slot, placement.entry.key)
      }
    }
  })
})

describe('what production may not have', () => {
  const productionNames = placementsFor('production').map((p) => p.name)

  it('excludes the sample household by declaration, not by omission', () => {
    // Its absence is the entire mechanism keeping fake households out of real
    // data — there is no runtime check behind it.
    expect(
      byKey('sampleDataEnabled')?.lands['convex-functions']?.environments,
    ).not.toContain('production')
    expect(productionNames).not.toContain('ENABLE_SAMPLE_DATA')
    expect(productionNames).not.toContain('VITE_ENABLE_SAMPLE_DATA')
  })

  it('excludes the published test-user credentials', () => {
    expect(productionNames).not.toContain('VITE_TEST_USER_EMAIL')
    expect(productionNames).not.toContain('VITE_TEST_USER_PASSWORD')
  })

  it('still carries them on stg, which is a prod-type deployment', () => {
    const stgNames = placementsFor('stg').map((p) => p.name)
    expect(stgNames).toContain('ENABLE_SAMPLE_DATA')
    expect(stgNames).toContain('VITE_ENABLE_SAMPLE_DATA')
  })
})

describe('values the deploy produces', () => {
  it('marks the deployed Convex URL as supplied rather than missing', () => {
    // Convex mints a backend per PR, so on preview there is no value anyone
    // could have stored. Without this, `check` would report a permanent and
    // unfixable failure.
    for (const environment of ['preview', 'stg', 'production'] as const) {
      const supplied = placementsFor(environment, { prNumber: '1' }).find(
        (p) => p.entry.key === 'convexUrl',
      )
      expect(supplied?.suppliedBy).toContain('convex deploy')
    }
  })

  it('stores it locally, where no deploy exists to produce it', () => {
    const local = placementsFor('local').find(
      (p) => p.entry.key === 'convexUrl',
    )
    expect(local?.suppliedBy).toBeNull()
    expect(local?.destination).toEqual({ kind: 'file', path: '.env.local' })
  })
})

describe('the issue reporter', () => {
  it('lands on every Worker, including the per-PR one', () => {
    // It previously ran on production alone, because nothing said otherwise.
    for (const environment of ENVIRONMENTS) {
      const workers = placementsFor(environment, { prNumber: '7' }).filter(
        (p) => p.entry.key === 'githubIssuesToken',
      )
      expect(workers).toHaveLength(1)
    }
    expect(
      placementsFor('preview', { prNumber: '7' }).find(
        (p) => p.entry.key === 'githubIssuesToken',
      )?.destination,
    ).toEqual({ kind: 'worker', worker: 'gather-pr-7' })
  })
})
