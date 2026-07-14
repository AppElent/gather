import { createServerFn } from '@tanstack/react-start'
import {
  buildIssueBody,
  buildIssueTitle,
  type IssueReporterRequest,
  type IssueReporterResponse,
  validateIssueReporterRequest,
} from '../lib/issueReporter'

export const reportIssue = createServerFn({ method: 'POST' })
  .validator((data: Partial<IssueReporterRequest>) => data)
  .handler(async ({ data }): Promise<IssueReporterResponse> => {
    const token = process.env.GITHUB_ISSUES_TOKEN
    const owner = process.env.GITHUB_REPOSITORY_OWNER
    const repo = process.env.GITHUB_REPOSITORY_NAME
    if (!token || !owner || !repo) {
      return { ok: false, error: 'GitHub issue reporter is not configured.' }
    }

    const validated = validateIssueReporterRequest(data)
    if (!validated.ok) {
      return { ok: false, error: validated.error }
    }
    const { type, text, url, user } = validated.value

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: buildIssueTitle(type, text),
          body: buildIssueBody(text, url, user),
          labels: [type],
        }),
      },
    )

    if (!response.ok) {
      return { ok: false, error: 'GitHub issue creation failed.' }
    }

    const issue = (await response.json()) as { html_url?: string }
    return { ok: true, issueUrl: issue.html_url ?? '' }
  })
