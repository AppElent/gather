import { type RenderOptions, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { type Locale, LocaleProvider } from '../../lib/i18n'
import {
  CurrentGroupContext,
  type CurrentGroupValue,
  type ShellGroup,
} from './useCurrentGroup'

export const TEST_GROUP: ShellGroup = {
  _id: 'g_household' as Id<'groups'>,
  name: 'Jansen household',
  slug: 'jansen-household',
  role: 'admin',
}

/**
 * Render a page inside a Current Group, in a locale.
 *
 * Group-scoped pages read the Group from context and throw without one, so
 * every test of one needs this. One helper rather than a per-suite mock of
 * `useCurrentGroup`, so the pages are tested against the real hook.
 */
export function renderInGroup(
  ui: ReactElement,
  {
    group = TEST_GROUP,
    groups = group ? [group] : [],
    setCurrentGroup = () => {},
    locale = 'en',
    ...options
  }: RenderOptions & {
    locale?: Locale
  } & Partial<{
      group: ShellGroup | null
      groups: ShellGroup[] | undefined
      setCurrentGroup: CurrentGroupValue['setCurrentGroup']
    }> = {},
) {
  const value: CurrentGroupValue = { current: group, groups, setCurrentGroup }
  return render(ui, {
    wrapper: ({ children }) => (
      <LocaleProvider initialLocale={locale}>
        <CurrentGroupContext value={value}>{children}</CurrentGroupContext>
      </LocaleProvider>
    ),
    ...options,
  })
}
