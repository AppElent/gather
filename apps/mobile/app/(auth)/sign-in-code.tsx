/**
 * Route for the code half of passwordless sign-in: validates the `email` param
 * and renders the screen, which lives in `src/features/auth/sign-in-code/`.
 */
import { useLocalSearchParams } from 'expo-router'
import { SignInCodeScreen } from '../../src/features/auth/sign-in-code/sign-in-code-screen'

export default function SignInCode() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  return (
    <SignInCodeScreen email={typeof email === 'string' ? email : undefined} />
  )
}
