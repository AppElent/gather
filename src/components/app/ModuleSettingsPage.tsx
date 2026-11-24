import { type ModuleId, moduleById } from '@gather/core/modules'
import type { ReactNode } from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import { moduleLink } from '../../lib/links'
import { Breadcrumbs } from './Breadcrumbs'
import { InsetList, SectionFooter, SectionLabel } from './InsetList'
import { WashHeader, type WashSummary } from './WashHeader'

/**
 * The frame of a Module's settings page (APP-800), the phone's `SettingsPage`
 * on the web: the trail back to the Module, its wash header, then groups.
 *
 * The gear in the Module's own header (`WashHeader`'s `settings`) opens it, at
 * `/<module>/settings`. A Module with nothing to set has neither
 * (docs/runbooks/add-a-module.md).
 */
export function ModuleSettingsPage({
  moduleId,
  summary,
  children,
}: {
  moduleId: ModuleId
  summary?: WashSummary
  children: ReactNode
}) {
  const messages = useMessages()
  const module = moduleById(moduleId)
  const label = messages.modules.byId[moduleId].label
  const title = fmt(messages.shell.modulePage.settingsTitle, { module: label })
  if (!module) return null
  const back = { label, link: moduleLink(module) }

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs trail={[back, { label: title }]} className="-mb-1" backInHeader />
      <WashHeader
        group={module.group}
        icon={module.icon}
        title={title}
        summary={summary}
        back={back}
      />
      {children}
    </div>
  )
}

/** One list of settings: its label, its rows, and whose settings they are. */
export function ModuleSettingsGroup({
  title,
  label,
  footer,
  children,
}: {
  title?: string
  /** Names the list for assistive technology when there is no title. */
  label?: string
  footer?: string
  children: ReactNode
}) {
  return (
    <section>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <InsetList label={label ?? title}>{children}</InsetList>
      {footer ? <SectionFooter>{footer}</SectionFooter> : null}
    </section>
  )
}
