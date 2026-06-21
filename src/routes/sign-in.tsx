import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInForm, TestLoginButton, useAuthConfig } from '@appelent/auth'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const onSuccess = () => navigate({ to: paths.afterAuth })

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <SignInForm onSuccess={onSuccess} />
      <TestLoginButton onSuccess={onSuccess} />
    </main>
  )
}
