/**
 * What every Finances screen needs before it can draw a single figure: the
 * Group it is in, and formatters bound to the euro — every Group counts in
 * euros — and the reader's language.
 *
 * The Group is ambient on the phone (ADR-0015) but every Convex function in
 * this Module still takes a `groupSlug`, because a write happens at the address
 * that names its Group (ADR-0007).
 */
import { localIsoDate } from '@gather/core/civil-date'
import { useMemo } from 'react'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { formatters } from './format'
import { HOME_CURRENCY } from './portfolioView'

export function useFinances() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const groupSlug = group.slug

  const currency = HOME_CURRENCY

  const format = useMemo(() => formatters(locale, HOME_CURRENCY), [locale])

  return {
    groupSlug,
    groupName: group.name,
    locale,
    currency,
    format,
    text: t.finances,
    /** Read once per render rather than per row: every screen dates from it. */
    today: localIsoDate(),
  }
}
