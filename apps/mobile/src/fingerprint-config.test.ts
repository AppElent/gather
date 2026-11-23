import { describe, expect, test } from 'vitest'

type FingerprintConfig = { extraSources?: { type: string; filePath: string }[] }

// A plain path keeps TypeScript from resolving the untyped CommonJS config.
const configPath = '../fingerprint.config.js'

describe('runtime fingerprint config', () => {
  // A Swift-only change under targets/ must ask for a new build instead of
  // shipping over the air to builds without that native code (APP-659).
  test('hashes the Apple targets folder', async () => {
    const { default: config } = (await import(/* @vite-ignore */ configPath)) as { default: FingerprintConfig }
    expect(config.extraSources).toContainEqual(expect.objectContaining({ type: 'dir', filePath: 'targets' }))
  })
})
