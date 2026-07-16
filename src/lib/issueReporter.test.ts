import { expect, test } from 'vitest'
import {
  buildIssueBody,
  buildIssueTitle,
  formatGitHubIssueError,
  formatIssueReporterUser,
  validateIssueReporterRequest,
} from './issueReporter'

test('validateIssueReporterRequest accepts a well-formed body', () => {
  const result = validateIssueReporterRequest({
    type: 'bug',
    text: 'The recipe list is empty after saving',
    url: 'https://gather.example/recipes',
  })
  expect(result.ok).toBe(true)
})

test('validateIssueReporterRequest rejects an unknown type', () => {
  const result = validateIssueReporterRequest({
    type: 'not-a-type' as never,
    text: 'hello',
    url: 'https://gather.example',
  })
  expect(result).toEqual({
    ok: false,
    error: 'Missing issue type, text, or URL.',
  })
})

test('validateIssueReporterRequest rejects blank text', () => {
  const result = validateIssueReporterRequest({
    type: 'bug',
    text: '   ',
    url: 'https://gather.example',
  })
  expect(result.ok).toBe(false)
})

test('validateIssueReporterRequest rejects a missing url', () => {
  const result = validateIssueReporterRequest({ type: 'bug', text: 'hello' })
  expect(result.ok).toBe(false)
})

test('formatIssueReporterUser falls back to anonymous', () => {
  expect(formatIssueReporterUser(undefined)).toBe('anonymous')
})

test('formatIssueReporterUser joins available fields', () => {
  expect(
    formatIssueReporterUser({ name: 'Eric', email: 'eric@example.com' }),
  ).toBe('Eric / eric@example.com')
})

test('buildIssueTitle truncates long text to 80 characters', () => {
  const text = 'x'.repeat(120)
  const title = buildIssueTitle('bug', text)
  expect(title).toBe(`[bug] ${'x'.repeat(80)}`)
})

test('buildIssueBody includes the url and formatted user', () => {
  const body = buildIssueBody('Something broke', 'https://gather.example', {
    name: 'Eric',
  })
  expect(body).toContain('Something broke')
  expect(body).toContain('URL: https://gather.example')
  expect(body).toContain('User: Eric')
})

test('formatGitHubIssueError explains repository access failures', () => {
  const error = formatGitHubIssueError(404, 'Not Found')
  expect(error).toBe(
    'GitHub issue creation failed: repository not found or token cannot access it.',
  )
})
