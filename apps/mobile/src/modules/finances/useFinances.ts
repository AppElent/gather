/**
 * What every Finances screen needs before it can draw a single figure: the
 * Group it is in, the currency that Group counts in, and formatters bound to
 * both that and the reader's language.
 *
 * The Group is ambient on the phone (ADR-0015) but every Convex function in
 * this Module still takes a `groupSlug`, because a write happens at the address
 * that names its Group (ADR-0007).
 */
import { todayIso } from '@gather/core/finance'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'

import { api } from '../../../../../convex/_generated/api'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { formatters } from './format'

export function useFinances() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const groupSlug = group.slug

  const settings = useQuery(api.holdings.settings, { groupSlug })
  const currency = settings?.homeCurrency ?? 'EUR'

  const format = useMemo(() => formatters(locale, currency), [locale, currency])

  return {
    groupSlug,
    groupName: group.name,
    locale,
    currency,
    /** The manual conversions a Member entered, for foreign holdings. */
    rates: settings?.rates ?? [],
    format,
    text: t.finances,
    /** Read once per render rather than per row: every screen dates from it. */
    today: todayIso(),
  }
}
