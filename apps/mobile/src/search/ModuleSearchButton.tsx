/**
 * A Module's way into search (APP-613): a magnifying glass in its root's
 * header that pushes the one search screen inside All's stack, with that
 * Module preset as the filter. Back returns to the Module.
 *
 * A Module root draws it through `ModuleHeaderButtons`
 * (`ui/module-header-buttons.tsx`), which owns the header's order.
 */
import { type Href, useRouter } from 'expo-router'

import { fmt, useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { useTokens } from '../theme/tokens'
import { HeaderIconButton } from '../ui/header-icon-button'
import type { SearchModuleId } from './searchFilters'

export function moduleSearchHref(module: SearchModuleId): Href {
  return { pathname: '/all/search', params: { module } }
}

/** The label and the push, for a header that draws its own buttons (Calendar). */
export function useModuleSearch(module: SearchModuleId) {
  const router = useRouter()
  const { t } = useI18n()
  return {
    label: fmt(t.search.inModule, { module: t.modules.byId[module].label }),
    open: () => router.push(moduleSearchHref(module)),
  }
}

export function ModuleSearchButton({ module }: { module: SearchModuleId }) {
  const tokens = useTokens()
  const search = useModuleSearch(module)
  return (
    <HeaderIconButton
      label={search.label}
      testID={`${module}-search`}
      onPress={search.open}
    >
      <UI_ICONS.Search size={22} color={tokens.ink} strokeWidth={2.2} />
    </HeaderIconButton>
  )
}
