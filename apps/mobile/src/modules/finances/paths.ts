/**
 * Where a Finances screen can send you, given which tab it is mounted under.
 *
 * The same rule and the same cast as `modules/baby/paths.ts`: Modules live
 * inside the tab stacks (ADR-0023), so every screen here exists at two
 * addresses and each keeps its own back stack. A screen takes a `base` and
 * builds from it, which is what lets one component serve both route trees.
 *
 * Back points at the parent's address, never at history — a Loan part's back
 * is its calculation whether you arrived from the House or from a deep link.
 */
import type { Href } from 'expo-router'

/** The tab stacks this Module is mounted in. */
export type FinanceBase = '/home/finances' | '/all/finances'

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
