/**
 * What Settings contains, and how a name is found in it.
 *
 * The tab is a grouped list — the platform's own shape, and the one that grows
 * by getting longer rather than by getting cleverer. That only works while a
 * person can still find the row, which is why the list is declared here as data
 * and the search field matches against the same declaration. A setting that is
 * rendered but not indexed would be a setting nobody can search for, and
 * nothing about a screen would ever tell you.
 *
 * **When you add a setting, add it here** — the screen has no second list to
 * fall out of step with, because it draws this one.
 *
 * Messages arrive as a parameter rather than from the context (ADR-0011's third
 * rule), which is what lets the matcher be tested with no React tree.
 */
import type { AppearancePreference } from '@gather/core/appearance'
import type { Locale } from '@gather/core/i18n'

import type { Messages } from '../i18n'

export type SettingsSectionId = 'account' | 'phone' | 'modules'

export type SettingsEntryId =
  | 'account'
  | 'groups'
  | 'appearance'
  | 'language'
  | 'baby-log'

/** The screens below the tab's index. Typed so a dead link fails the build. */
export type SettingsHref =
  | '/settings/account'
  | '/settings/groups'
  | '/settings/appearance'
  | '/settings/language'
  | '/settings/baby-log'

export interface SettingsEntry {
  id: SettingsEntryId
  label: string
  /**
   * What it is set to now, drawn on the right of the row. Absent where the row
   * is a place rather than a choice — Account has no value, it has contents.
   */
  value?: string
  href: SettingsHref
}

export interface SettingsSection {
  id: SettingsSectionId
  title: string
  entries: SettingsEntry[]
}

/** The live values the list shows on the right of a row. */
export interface SettingsValues {
  appearance: AppearancePreference
  locale: Locale
  /**
   * The ambient Group's name. A Module's settings belong to a Group, and this
   * screen draws no Group chrome of its own — so the row's value column is the
   * only place that says which household is about to be edited.
   */
  groupName: string
}

/**
 * The two groups are a claim about where a setting lives, not a filing
 * convenience: Account and Groups follow the person to any device, and
 * Appearance and Language are written to this phone and stay on it. A member
 * who reads "On this phone" and then finds their language unchanged on the
 * tablet has been told why in advance.
 */
export function settingsSections(
  t: Messages,
  values: SettingsValues,
): SettingsSection[] {
  return [
    {
      id: 'account',
      title: t.settings.sections.account,
      entries: [
        {
          id: 'account',
          label: t.settings.account,
          href: '/settings/account',
        },
        {
          id: 'groups',
          label: t.settings.groups,
          href: '/settings/groups',
        },
      ],
    },
    {
      /**
       * A Module's own preferences live *inside* Settings and never beside it
       * (ADR-0018). The rows are per Group, which is why each carries the
       * Group's name as its value.
       */
      id: 'modules',
      title: t.settings.sections.modules,
      entries: [
        {
          id: 'baby-log',
          label: t.modules.byId['baby-log'].label,
          value: values.groupName,
          href: '/settings/baby-log',
        },
      ],
    },
    {
      id: 'phone',
      title: t.settings.sections.phone,
      entries: [
        {
          id: 'appearance',
          label: t.settings.appearance.title,
          value: t.settings.appearance.modes[values.appearance],
          href: '/settings/appearance',
        },
        {
          id: 'language',
          label: t.settings.language.title,
          value: t.settings.language.names[values.locale],
          href: '/settings/language',
        },
      ],
    },
  ]
}

export interface SettingsHit {
  section: SettingsSection
  entry: SettingsEntry
}

/**
 * A match on the label, the group it is in, or what it is currently set to.
 *
 * The last of those is the one worth keeping: somebody looking for dark mode
 * types "dark", which is the value and never the label. Matching the group as
 * well is what makes "phone" answer with both of the settings that live on it.
 *
 * A blank query is not a match-everything — the caller draws the list instead,
 * and returning all of it here would make an empty field look like a search
 * that had already happened.
 */
export function searchSettings(
  sections: SettingsSection[],
  query: string,
): SettingsHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  return sections.flatMap((section) =>
    section.entries
      .filter((entry) =>
        [entry.label, entry.value, section.title].some((field) =>
          field?.toLowerCase().includes(needle),
        ),
      )
      .map((entry) => ({ section, entry })),
  )
}
