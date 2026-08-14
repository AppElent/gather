/**
 * All — the whole Module catalogue, which arrives in #163.
 *
 * What it does own today is the reset: a Module opened from here is pushed onto
 * this stack, and a Group switch has to unwind it (ADR-0015).
 */
import { ShellStub } from '../../../../src/components/ShellStub'
import { useI18n } from '../../../../src/i18n'

export default function AllTab() {
  const { t } = useI18n()

  return <ShellStub title={t.shell.stub.all} body={t.shell.stub.allBody} />
}
