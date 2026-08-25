/**
 * NetWorth, mounted under all.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { NetWorthScreen } from '../../../../../src/modules/finances/NetWorthScreen'

export default function FinancesNetWorth() {
  return <NetWorthScreen base="/all/finances" />
}
