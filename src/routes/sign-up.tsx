import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { SignUpForm, useAuthConfig } from '../lib/auth'
import { useMessages } from '../lib/i18n'

export const Route = createFileRoute('/sign-up')({ component: SignUpPage })

export function SignUpPage() {
  const navigate = useNavigate()
  const { paths } = useAuthConfig()
  const { signUp: text } = useMessages().auth
  const onSuccess = () => navigate({ to: paths.afterAuth })

  return (
    <PublicPageFrame
      eyebrow={text.eyebrow}
      title={text.title}
      subtitle={text.subtitle}
    >
      <SignUpForm onSuccess={onSuccess} />
    </PublicPageFrame>
  )
}
