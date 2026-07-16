import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
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
  render(<IssueReporterModal />)
  expect(screen.queryByText('Report an issue')).toBeNull()
  openModal()
  expect(screen.getByText('Report an issue')).toBeDefined()
})

test('submits the report with the current user and page url', async () => {
  reportIssueMock.mockResolvedValue({
    ok: true,
    issueUrl: 'https://github.com/o/r/issues/1',
  })
  render(<IssueReporterModal />)
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
      user: {
        id: 'user_123',
        email: 'eric@example.com',
        name: 'Eric Jansen',
      },
    },
  })
})

test('shows the server-reported error', async () => {
  reportIssueMock.mockResolvedValue({
    ok: false,
    error: 'GitHub issue reporter is not configured.',
  })
  render(<IssueReporterModal />)
  openModal()

  fireEvent.change(screen.getByPlaceholderText(/what happened/i), {
    target: { value: 'Something broke' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await screen.findByText('GitHub issue reporter is not configured.')
})
