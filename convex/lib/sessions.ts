/** The refusal for something that is not a Clerk session id. */
export const INVALID_SESSION_ID = 'Not a session id'

/** Whether a string is a Clerk session id. */
export function isSessionId(value: string) {
  return /^sess_[A-Za-z0-9]{1,64}$/.test(value)
}
