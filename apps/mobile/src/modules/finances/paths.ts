/**
 * Where a Finances screen can send you, given which tab it is mounted under.
 *
 * The same rule and the same cast as `modules/baby/paths.ts`: released Modules
 * live inside both tab stacks (ADR-0023), while unfinished tools live under
 * Settings > Labs. A screen takes a `base` so one component can serve the
 * relevant route trees without knowing which surface mounted it.
 *
 * Back points at the parent's address, never at history — a Loan part's back
 * is its calculation whether you arrived from the House or from a deep link.
 */
import type { Href } from 'expo-router'

/** The released Money Modules and local-development lab that own these screens. */
export type FinanceBase =
  | '/home/recurring-costs'
  | '/all/recurring-costs'
  | '/home/savings-goals'
  | '/all/savings-goals'
  | '/settings/labs/finance'

export type FinanceScreen =
  | ''
  | '/house'
  | '/mortgage'
  | '/part'
  | '/timeline'
  | '/buying-costs'
  | '/recurring'
  | '/cost'
  | '/split'
  | '/savings'
  | '/goal'
  | '/portfolio'
  | '/holding'
  | '/net-worth'

export function financeHref(
  base: FinanceBase,
  screen: FinanceScreen,
  params?: Record<string, string>,
): Href {
  const path = `${base}${screen}`
  return (params ? { pathname: path, params } : path) as Href
}
