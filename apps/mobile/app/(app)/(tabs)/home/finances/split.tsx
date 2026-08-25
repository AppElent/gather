/**
 * Split, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { SplitScreen } from '../../../../../src/modules/finances/SplitScreen'

export default function FinancesSplit() {
  return <SplitScreen base="/home/finances" />
}
