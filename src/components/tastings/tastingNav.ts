import type { TastingKind } from '@gather/core/tastings'
import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'

export interface TastingNav {
  list: AppLink
  subject: (subjectId: string) => AppLink
  edit: (subjectId: string) => AppLink
}

export function groupTastingNav(
  kind: TastingKind,
  groupSlug: string,
): TastingNav {
  switch (kind) {
    case 'cheese':
      return {
        list: groupLink('cheeses', groupSlug),
        subject: (subjectId) => groupLink('cheese', groupSlug, { subjectId }),
        edit: (subjectId) => groupLink('editCheese', groupSlug, { subjectId }),
      }
    case 'wine':
      return {
        list: groupLink('wines', groupSlug),
        subject: (subjectId) => groupLink('wine', groupSlug, { subjectId }),
        edit: (subjectId) => groupLink('editWine', groupSlug, { subjectId }),
      }
    case 'beer':
      return {
        list: groupLink('beers', groupSlug),
        subject: (subjectId) => groupLink('beer', groupSlug, { subjectId }),
        edit: (subjectId) => groupLink('editBeer', groupSlug, { subjectId }),
      }
  }
}
