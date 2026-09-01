/** The avatar is decorative until Clerk has resolved who the reader is. */
export function identityInitial(
  isLoaded: boolean,
  name: string | null | undefined,
  email: string,
) {
  if (!isLoaded) return null
  return (name?.trim() || email).slice(0, 1).toUpperCase()
}
