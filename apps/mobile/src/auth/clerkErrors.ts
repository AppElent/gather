/**
 * Clerk's error codes, turned into gather's words.
 *
 * Every Core 3 call resolves to `{ error: ClerkError | null }` rather than
 * throwing, and `useSignIn()` / `useSignUp()` additionally expose the last
 * fetch's errors split into `fields` and `global`. Both shapes carry a
 * machine-stable `code` and a `message` that Clerk's own docs say not to show
 * to a person, so the code is the only thing worth reading.
 *
 * A code we have not mapped falls back to `errors.generic`. That is the right
 * default and also the reason this file logs the unmapped code in development:
 * the mapping below can only grow by someone noticing a gap.
 *
 * Clerk **Core 3** (ADR-0014). The phone is a Clerk generation ahead of the
 * web, which is Core 2 via `@appelent/auth` — so that package's form logic
 * reads like a reference implementation and is not one. Same hook names,
 * different returns: `{ error }` instead of `throw`, `finalize()` instead of
 * `setActive()`, per-field errors on the hook's `errors` signal.
 */
import type { Messages } from '../i18n'

type ErrorKey = keyof Messages['errors']

/** Anything with a Clerk error code — a `ClerkError` or a `FieldError`. */
export interface CodedError {
  code: string
  message?: string
}

const CODE_MAP: Record<string, ErrorKey> = {
  form_identifier_not_found: 'identifierNotFound',
  form_password_incorrect: 'passwordIncorrect',
  form_identifier_exists: 'identifierExists',
  form_param_format_invalid: 'emailInvalid',
  form_param_nil: 'required',
  form_param_missing: 'required',
  form_password_length_too_short: 'passwordTooShort',
  form_password_pwned: 'passwordPwned',
  form_password_validation_failed: 'passwordIncorrect',
  form_code_incorrect: 'codeIncorrect',
  verification_failed: 'codeIncorrect',
  verification_expired: 'codeExpired',
  too_many_requests: 'tooManyRequests',
  rate_limit_exceeded: 'tooManyRequests',
  network_error: 'network',
}

/** `null` in, `null` out — so a call site can render this straight into `<AuthError>`. */
export function readError(
  error: CodedError | null | undefined,
  t: Messages,
): string | null {
  if (!error) return null
  const key = CODE_MAP[error.code]
  if (!key) {
    if (__DEV__) console.warn(`[auth] unmapped Clerk error code: ${error.code}`)
    return t.errors.generic
  }
  return t.errors[key]
}

/** The shape of `useSignIn().errors` / `useSignUp().errors`, minus the specifics. */
export interface ErrorSignal<TFields extends object> {
  fields: TFields
  global: readonly CodedError[] | null
}

/**
 * The first thing worth saying out of a whole `errors` signal. Field errors come
 * first because they name what to fix; a global error is the fallback.
 */
export function readErrors<TFields extends object>(
  errors: ErrorSignal<TFields>,
  t: Messages,
): string | null {
  for (const field of Object.values(errors.fields) as (CodedError | null)[]) {
    if (field) return readError(field, t)
  }
  return readError(errors.global?.[0], t)
}

/**
 * What to show after a failed Core 3 call — and the one piece of this that is
 * genuinely counter-intuitive.
 *
 * The `{ error }` a method resolves with is a **wrapper**: a wrong password
 * comes back as `api_response_error`, not `form_password_incorrect`. The
 * machine-stable code is on the hook's `errors` signal instead
 * (`errors.fields.password.code`), which updates and re-renders. Reading only
 * the returned error — the obvious thing to write — turns every real, mappable
 * failure into "Something went wrong."
 *
 * So the signal wins, and the returned wrapper is the fallback for the failures
 * that never reach the API at all: no network, no field to blame.
 *
 * The signal cannot be read inside the async callback that made the call — that
 * closure holds the value from the render *before* the fetch — so this is
 * called during render, with the wrapper held in state.
 */
export function pickError<TFields extends object>(
  errors: ErrorSignal<TFields>,
  returned: CodedError | null,
  t: Messages,
): string | null {
  return readErrors(errors, t) ?? readError(returned, t)
}
