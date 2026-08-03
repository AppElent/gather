import { SignUpForm, useAuthConfig } from '@appelent/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'

export const Route = createFileRoute('/sign-up')({ component: SignUpPage })

export function SignUpPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const onSuccess = () => navigate({ to: paths.afterAuth })

  return (
    <PublicPageFrame
      eyebrow="Create account"
      title="Start using Gather"
      subtitle="Create your account and start a group to share."
    >
      <SignUpForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
