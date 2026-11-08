import type { TastingKind } from '@gather/core/tastings'
import { type AppLink, linkTo } from '../../lib/links'

/** Where each kind's pages live: one table, one row per kind. */
export const TASTING_LINKS: Record<
  TastingKind,
  {
    list: AppLink
    subject: (subjectId: string) => AppLink
    edit: (subjectId: string) => AppLink
  }
> = {
  cheese: {
    list: linkTo('cheeses'),
    subject: (subjectId) => linkTo('cheese', { subjectId }),
    edit: (subjectId) => linkTo('editCheese', { subjectId }),
  },
  wine: {
    list: linkTo('wines'),
    subject: (subjectId) => linkTo('wine', { subjectId }),
    edit: (subjectId) => linkTo('editWine', { subjectId }),
  },
  beer: {
    list: linkTo('beers'),
    subject: (subjectId) => linkTo('beer', { subjectId }),
    edit: (subjectId) => linkTo('editBeer', { subjectId }),
  },
}
