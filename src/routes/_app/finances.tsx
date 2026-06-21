import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'
import { MODULES } from '../../lib/modules'

const def = MODULES.find((m) => m.id === 'finances')!

export const Route = createFileRoute('/_app/finances')({
  component: () => (
    <ModulePlaceholder label={def.label} description={def.description} icon={def.icon} />
  ),
})
