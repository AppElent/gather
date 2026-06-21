import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'
import { MODULES } from '../../lib/modules'

const def = MODULES.find((m) => m.id === 'cheeses')!

export const Route = createFileRoute('/_app/cheeses')({
  component: () => (
    <ModulePlaceholder
      label={def.label}
      description={def.description}
      icon={def.icon}
    />
  ),
})
