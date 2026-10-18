import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { SignInForm, useAuthConfig } from '../lib/auth'
import { useMessages } from '../lib/i18n'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

export function SignInPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const { signIn: text } = useMessages().auth
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
      <SignInForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
