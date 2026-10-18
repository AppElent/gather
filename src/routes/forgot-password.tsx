import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { ForgotPasswordForm, useAuthConfig } from '../lib/auth'
import { useMessages } from '../lib/i18n'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const { forgotPassword: text } = useMessages().auth
  const onSuccess = () => navigate({ to: paths.signIn })

  return (
    <PublicPageFrame
      eyebrow={text.eyebrow}
      title={text.title}
      subtitle={text.subtitle}
    >
      <ForgotPasswordForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
