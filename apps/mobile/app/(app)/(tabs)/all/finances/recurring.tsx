/**
 * Recurring, mounted under all.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { RecurringScreen } from '../../../../../src/modules/finances/RecurringScreen'

export default function FinancesRecurring() {
  return <RecurringScreen base="/all/finances" />
}
