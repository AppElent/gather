import { describe, expect, test } from 'vitest'
import config from '../fingerprint.config.js'

describe('runtime fingerprint config', () => {
  // A Swift-only change under targets/ must ask for a new build instead of
  // shipping over the air to builds without that native code (APP-659).
  test('hashes the Apple targets folder', () => {
    expect(config.extraSources).toContainEqual(expect.objectContaining({ type: 'dir', filePath: 'targets' }))
  })
})
