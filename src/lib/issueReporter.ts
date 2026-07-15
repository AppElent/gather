export const ISSUE_REPORTER_TYPES = [
  'bug',
  'enhancement',
  'docs',
  'question',
] as const

export type IssueReporterType = (typeof ISSUE_REPORTER_TYPES)[number]

export interface IssueReporterUser {
  id?: string
  email?: string
  name?: string
}

export interface IssueReporterRequest {
  type: IssueReporterType
  text: string
  url: string
  user?: IssueReporterUser
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
  return { ok: true, value: { type, text, url, user: body?.user } }
}

export function formatIssueReporterUser(
  user: IssueReporterUser | undefined,
): string {
  if (!user) return 'anonymous'
  return (
    [user.name, user.email, user.id].filter(Boolean).join(' / ') || 'anonymous'
  )
}

export function buildIssueTitle(type: IssueReporterType, text: string): string {
  return `[${type}] ${text.slice(0, 80)}`
}

export function buildIssueBody(
  text: string,
  url: string,
  user: IssueReporterUser | undefined,
): string {
  return [
    text,
    '',
    '---',
    `URL: ${url}`,
    `User: ${formatIssueReporterUser(user)}`,
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
