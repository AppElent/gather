import { assertMessageParity } from '@appelent/i18n/test-utils'
import { en } from '../messages/en'
import { nl } from '../messages/nl'

/**
 * Every locale says the same things, in the same slots, with the same
 * placeholders.
 *
 * `satisfies` in each locale's files already catches a missing or stray *key*
 * at compile time. This catches what a type cannot see: a string left empty,
 * and a `{placeholder}` that one locale interpolates and another silently
 * drops — which is how a translated sentence ends up naming nothing.
 *
 * It is also what makes every later extraction provably finished. There is no
 * app-specific test of `resolveLocale`, `fmt` or `plural` here: those live in
 * `@appelent/i18n` and are tested there.
 */
assertMessageParity({ en, nl })
