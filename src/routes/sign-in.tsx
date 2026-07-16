import { SignInForm, useAuthConfig } from '@appelent/auth'
import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { PublicPageFrame } from '../components/app/PublicPageFrame'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

export function SignInPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const { isLoaded, isSignedIn } = useAuth()
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
        eyebrow="Signed in"
        title="Opening Gather"
        subtitle="Taking you to the command center."
      >
        <p className="m-0 text-sm text-[var(--app-muted)]">Redirecting...</p>
      </PublicPageFrame>
    )
  }

  return (
    <PublicPageFrame
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Use your Gather account to open the command center."
    >
      <SignInForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
