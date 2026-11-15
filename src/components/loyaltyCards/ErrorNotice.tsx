/** A save or delete that failed, said above the form it belongs to. */
export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="m-0 rounded-[var(--app-radius)] border border-[var(--app-danger)] px-3 py-2 text-sm text-[var(--app-danger)]"
    >
      {message}
    </p>
  )
}
