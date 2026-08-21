/**
 * One entry, mounted under home.
 *
 * The only screen in this Module the navigator presents as a sheet rather than
 * a push — see `EntryScreen` for why, and the stack layout for the options that
 * make it one.
 */
import { EntryScreen } from '../../../../../src/modules/baby/EntryScreen'

export default function BabyLogEntry() {
  return <EntryScreen />
}
