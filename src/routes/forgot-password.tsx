import { ForgotPasswordForm, useAuthConfig } from '@appelent/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const onSuccess = () => navigate({ to: paths.signIn })

  return (
    <PublicPageFrame
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Send a recovery code and get back to your group workspace."
    >
      <ForgotPasswordForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
