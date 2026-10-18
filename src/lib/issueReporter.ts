export const ISSUE_REPORTER_TYPES = [
  'bug',
  'enhancement',
  'docs',
  'question',
] as const

export type IssueReporterType = (typeof ISSUE_REPORTER_TYPES)[number]

export interface IssueReporterRequest {
  type: IssueReporterType
  text: string
  url: string
  /** Whether the reporter is signed in. Nothing that identifies them is sent. */
  signedIn?: boolean
}

export type IssueReporterResponse =
  | { ok: true; issueUrl: string }
  | { ok: false; error: string }

export function isIssueReporterType(
  value: unknown,
): value is IssueReporterType {
  return (
    typeof value === 'string' &&
    (ISSUE_REPORTER_TYPES as readonly string[]).includes(value)
  )
}

export function validateIssueReporterRequest(
  body: Partial<IssueReporterRequest> | null | undefined,
): { ok: true; value: IssueReporterRequest } | { ok: false; error: string } {
  const type = body?.type
  const text = body?.text?.trim()
  const url = body?.url
  if (!type || !isIssueReporterType(type) || !text || !url) {
    return { ok: false, error: 'Missing issue type, text, or URL.' }
  }
  return {
    ok: true,
    value: { type, text, url, signedIn: body?.signedIn === true },
  }
}

const EMAIL_PATTERN = /[^\s/@%]+(?:@|%40)[^\s/@%]+\.[^\s/@%]+/gi

/**
 * Issues are filed on a public repository, so the page address is reduced to
 * origin and path: the query string and fragment (where emails, tokens and
 * invite codes end up) are dropped, and anything in the path shaped like an
 * email address is masked. An unparseable address is not echoed at all.
 */
export function sanitizeIssueUrl(url: string): string {
  try {
    const { origin, pathname } = new URL(url)
    return `${origin}${pathname}`.replace(EMAIL_PATTERN, '[redacted]')
  } catch {
    return '[unavailable]'
  }
}

export function buildIssueTitle(type: IssueReporterType, text: string): string {
  return `[${type}] ${text.slice(0, 80)}`
}

/**
 * The body never names the reporter: no name, email or user id, only whether
 * they were signed in.
 */
export function buildIssueBody(
  text: string,
  url: string,
  signedIn: boolean | undefined,
): string {
  return [
    text,
    '',
    '---',
    `URL: ${sanitizeIssueUrl(url)}`,
    `Reporter: ${signedIn ? 'signed in' : 'anonymous'}`,
  ].join('\n')
}

export function formatGitHubIssueError(
  status: number,
  message: string | undefined,
): string {
  if (status === 404) {
    return 'GitHub issue creation failed: repository not found or token cannot access it.'
  }

  const detail = message?.trim()
  if (detail) return `GitHub issue creation failed (${status}): ${detail}.`
  return `GitHub issue creation failed (${status}).`
}
