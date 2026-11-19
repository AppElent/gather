import { useAuth } from '@clerk/react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { SignInForm, useAuthConfig } from '../lib/auth'
import { useMessages } from '../lib/i18n'

/**
 * `?deleted=gather` is where deleting Gather's data lands (APP-397): signed
 * out, with the login still good elsewhere, which the page says once above
 * the form.
 */
export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>): { deleted?: 'gather' } =>
    search.deleted === 'gather' ? { deleted: 'gather' } : {},
})

export function SignInPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const { signIn: text } = useMessages().auth
  const { isLoaded, isSignedIn } = useAuth()
  const { deleted } = useSearch({ from: '/sign-in' })
  const dataDeleted = useMessages().settings.deleteAccount.dataOnly
  const onSuccess = useCallback(
    () => navigate({ to: paths.afterAuth }),
    [navigate, paths.afterAuth],
  )

  useEffect(() => {
    if (isLoaded && isSignedIn) onSuccess()
  }, [isLoaded, isSignedIn, onSuccess])

  if (isLoaded && isSignedIn) {
    return (
      <PublicPageFrame
        eyebrow={text.redirecting.eyebrow}
        title={text.redirecting.title}
        subtitle={text.redirecting.subtitle}
      >
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {text.redirecting.body}
        </p>
      </PublicPageFrame>
    )
  }

  return (
    <PublicPageFrame
      eyebrow={text.eyebrow}
      title={text.title}
      subtitle={text.subtitle}
    >
      {deleted === 'gather' ? (
        <div
          role="status"
          data-testid="gather-data-deleted"
          className="mb-4 grid gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2 text-sm"
        >
          <p className="m-0 font-semibold">{dataDeleted.doneTitle}</p>
          <p className="m-0 text-[var(--app-muted)]">{dataDeleted.doneBody}</p>
        </div>
      ) : null}
      <SignInForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
