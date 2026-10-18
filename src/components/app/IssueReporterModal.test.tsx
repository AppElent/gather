import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { IssueReporterModal } from './IssueReporterModal'

const reportIssueMock = vi.fn()

vi.mock('../../server/reportIssue', () => ({
  reportIssue: (...args: unknown[]) => reportIssueMock(...args),
}))

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'user_123',
      fullName: 'Eric Jansen',
      primaryEmailAddress: { emailAddress: 'eric@example.com' },
    },
  }),
}))

beforeEach(() => {
  reportIssueMock.mockReset()
})

function openModal() {
  fireEvent.keyDown(window, { key: 'i', ctrlKey: true, shiftKey: true })
}

test('is closed until the keyboard shortcut is pressed', () => {
  renderWithI18n(<IssueReporterModal />)
  expect(screen.queryByText('Report an issue')).toBeNull()
  openModal()
  expect(screen.getByText('Report an issue')).toBeDefined()
})

test('submits the report with the page url and signed-in flag, never the user identity', async () => {
  reportIssueMock.mockResolvedValue({
    ok: true,
    issueUrl: 'https://github.com/o/r/issues/1',
  })
  renderWithI18n(<IssueReporterModal />)
  openModal()

  fireEvent.change(screen.getByPlaceholderText(/what happened/i), {
    target: { value: 'The recipe list is empty after saving' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await screen.findByText('Thanks — your report was filed.')

  expect(reportIssueMock).toHaveBeenCalledWith({
    data: {
      type: 'bug',
      text: 'The recipe list is empty after saving',
      url: window.location.href,
      signedIn: true,
    },
  })
  expect(JSON.stringify(reportIssueMock.mock.calls)).not.toMatch(
    /user_123|eric@example\.com|Eric Jansen/,
  )
})

test('tells the reporter the report is public', () => {
  renderWithI18n(<IssueReporterModal />)
  openModal()
  expect(screen.getByText(/public GitHub issues/i)).toBeDefined()
})

test('shows the server-reported error', async () => {
  reportIssueMock.mockResolvedValue({
    ok: false,
    error: 'GitHub issue reporter is not configured.',
  })
  renderWithI18n(<IssueReporterModal />)
  openModal()

  fireEvent.change(screen.getByPlaceholderText(/what happened/i), {
    target: { value: 'Something broke' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await screen.findByText('GitHub issue reporter is not configured.')
})
