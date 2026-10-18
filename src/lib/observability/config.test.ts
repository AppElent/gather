import { describe, expect, it } from 'vitest'
import { environmentFromHostname, isLocalReportingUrl } from './config'

describe('isLocalReportingUrl', () => {
  it.each([
    'http://localhost:3000/',
    'http://app.localhost/',
    'http://127.0.0.1:8787/',
    'http://[::1]:3000/',
    'http://0.0.0.0:4173/',
  ])('treats %s as local', (url) => {
    expect(isLocalReportingUrl(url)).toBe(true)
  })

  it.each([
    'https://gather.workers.dev/',
    'https://gather.dev/localhost',
    'https://localhost.evil.dev/',
  ])('treats %s as deployed', (url) => {
    expect(isLocalReportingUrl(url)).toBe(false)
  })

  it('does not throw on an unparsable url', () => {
    expect(isLocalReportingUrl('not a url')).toBe(false)
  })
})

describe('environmentFromHostname', () => {
  it.each([
    ['gather-pr-216.example.workers.dev', 'preview'],
    ['gather-stg.example.workers.dev', 'staging'],
    ['gather-dev.example.workers.dev', 'development'],
    ['gather.example.workers.dev', 'production'],
    ['gather.example.com', 'production'],
  ])('%s -> %s', (host, expected) => {
    expect(environmentFromHostname(host)).toBe(expected)
  })
})
