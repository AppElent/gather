import { expect, test } from 'vitest'
import {
  buildIssueBody,
  buildIssueTitle,
  formatGitHubIssueError,
  sanitizeIssueUrl,
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

test('buildIssueTitle truncates long text to 80 characters', () => {
  const text = 'x'.repeat(120)
  const title = buildIssueTitle('bug', text)
  expect(title).toBe(`[bug] ${'x'.repeat(80)}`)
})

test('validateIssueReporterRequest drops any identity the client sends', () => {
  const result = validateIssueReporterRequest({
    type: 'bug',
    text: 'hello',
    url: 'https://gather.example',
    signedIn: true,
    user: { id: 'user_123', email: 'eric@example.com', name: 'Eric' },
  } as never)
  expect(result).toEqual({
    ok: true,
    value: {
      type: 'bug',
      text: 'hello',
      url: 'https://gather.example',
      signedIn: true,
    },
  })
})

test('sanitizeIssueUrl keeps origin and path but drops query and fragment', () => {
  expect(
    sanitizeIssueUrl(
      'https://gather.example/recipes/pasta?email=eric@example.com&token=abc#frag',
    ),
  ).toBe('https://gather.example/recipes/pasta')
})

test('sanitizeIssueUrl masks an email address in the path', () => {
  expect(
    sanitizeIssueUrl('https://gather.example/invite/eric@example.com'),
  ).toBe('https://gather.example/invite/[redacted]')
  expect(
    sanitizeIssueUrl('https://gather.example/invite/eric%40example.com'),
  ).toBe('https://gather.example/invite/[redacted]')
})

test('sanitizeIssueUrl does not echo an unparseable address', () => {
  expect(sanitizeIssueUrl('not a url eric@example.com')).toBe('[unavailable]')
})

test('buildIssueBody carries the sanitized url and signed-in state only', () => {
  const body = buildIssueBody(
    'Something broke',
    'https://gather.example/recipes?email=eric@example.com',
    true,
  )
  expect(body).toBe(
    [
      'Something broke',
      '',
      '---',
      'URL: https://gather.example/recipes',
      'Reporter: signed in',
    ].join('\n'),
  )
  expect(body).not.toMatch(/@|user_|eric/i)
})

test('buildIssueBody marks a signed-out reporter as anonymous', () => {
  expect(buildIssueBody('x', 'https://gather.example', undefined)).toContain(
    'Reporter: anonymous',
  )
})

test('formatGitHubIssueError explains repository access failures', () => {
  const error = formatGitHubIssueError(404, 'Not Found')
  expect(error).toBe(
    'GitHub issue creation failed: repository not found or token cannot access it.',
  )
})
