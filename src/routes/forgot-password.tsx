import { ForgotPasswordForm, useAuthConfig } from '@appelent/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const onSuccess = () => navigate({ to: paths.signIn })

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <ForgotPasswordForm onSuccess={onSuccess} />
    </main>
  )
}
