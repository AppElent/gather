import { SignUpForm, useAuthConfig } from '@appelent/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-up')({ component: SignUpPage })

function SignUpPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const onSuccess = () => navigate({ to: paths.afterAuth })

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <SignUpForm onSuccess={onSuccess} />
    </main>
  )
}
