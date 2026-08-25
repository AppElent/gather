/**
 * Finances, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { FinancesScreen } from '../../../../../src/modules/finances/FinancesScreen'

export default function FinancesIndex() {
  return <FinancesScreen base="/home/finances" />
}
