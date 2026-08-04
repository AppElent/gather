import { useMessages } from '../../lib/i18n'
import type { ModuleId } from '../../lib/modules'
import { moduleById } from '../../lib/modules'
import { Icon } from './Icon'
import { Pill, SurfaceCard } from './ShellPrimitives'

/**
 * Takes the Module's id and looks the rest up, rather than being handed a
 * label, a description and an icon by each of the nine routes that render it.
 * Three props every caller filled from the same registry row were three chances
 * to fill one from a different one — and now that two of the three are
 * translated, three chances to leave a page half in English.
 */
export function ModulePlaceholder({ moduleId }: { moduleId: ModuleId }) {
  const messages = useMessages()
  const { label, description } = messages.modules.byId[moduleId]
  const { placeholder } = messages.shell
  const icon = moduleById(moduleId)?.icon ?? 'Circle'

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <SurfaceCard>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
            <Icon name={icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-2xl font-semibold">{label}</h1>
              <Pill>{placeholder.planned}</Pill>
            </div>
            <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">
              {description}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="m-0 text-sm font-semibold">
          {placeholder.whatWillLiveHere}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
          {placeholder.body}
        </p>
      </SurfaceCard>
    </div>
  )
}
