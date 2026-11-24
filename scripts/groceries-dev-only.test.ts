import { describe, expect, it } from 'vitest'
import { assertDevDeployment, deploymentFromEnvFile } from './groceries/devOnly'

describe('ask-ai.ts dev-only guard (APP-751)', () => {
  it('accepts a dev deployment from the environment or .env.local', () => {
    expect(assertDevDeployment({ CONVEX_DEPLOYMENT: 'dev:basic-ibex-235' }, null)).toBe(
      'dev:basic-ibex-235',
    )
    expect(
      assertDevDeployment({}, 'CONVEX_URL=x\nCONVEX_DEPLOYMENT=dev:basic-ibex-235 # team: a\n'),
    ).toBe('dev:basic-ibex-235')
  })

  it('refuses production, preview and anonymous deployments', () => {
    for (const deployment of ['prod:calm-fox-1', 'preview:x', 'anonymous:local'])
      expect(() => assertDevDeployment({ CONVEX_DEPLOYMENT: deployment }, null)).toThrow(
        /only ever runs against a dev deployment/,
      )
  })

  it('lets a deploy key win over the selected deployment', () => {
    expect(() =>
      assertDevDeployment(
        { CONVEX_DEPLOY_KEY: 'prod:calm-fox-1|secret', CONVEX_DEPLOYMENT: 'dev:a' },
        null,
      ),
    ).toThrow(/prod:calm-fox-1/)
    expect(
      assertDevDeployment({ CONVEX_DEPLOY_KEY: 'dev:a|secret' }, null),
    ).toBe('dev:a')
  })

  it('refuses when no deployment can be found', () => {
    expect(() => assertDevDeployment({}, null)).toThrow(/cannot tell/)
    expect(() => assertDevDeployment({}, '# nothing here\n')).toThrow(/cannot tell/)
  })

  it('reads quoted values and ignores commented lines', () => {
    expect(deploymentFromEnvFile('CONVEX_DEPLOYMENT="dev:a"')).toBe('dev:a')
    expect(deploymentFromEnvFile('#CONVEX_DEPLOYMENT=prod:a')).toBeNull()
  })
})
