import { groceryListsOf, openGroceryList } from '@gather/core/grocery-list'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { EmptyState } from '../app/EmptyState'
import { InsetRow } from '../app/InsetList'
import { ListLoadingState } from '../app/ListDetailLayout'
import {
  ModuleSettingsGroup,
  ModuleSettingsPage,
} from '../app/ModuleSettingsPage'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { AisleOrderDialog } from './GroceryDialogs'
import { readLastGroceryList } from './preferences'

type GroceryList = FunctionReturnType<typeof api.taskLists.list>[number]

/**
 * Groceries settings (APP-861), the phone's page on the web: the standing
 * choices of the grocery list the gear was pressed on, or of the one the
 * Module would open. Both are the list's own, shared with the Group.
 */
export function GroceriesSettingsPage({ listId }: { listId?: string }) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const g = messages.tasks.grocery
  const allLists = useQuery(api.taskLists.list, { groupSlug })
  const list = openGroceryList(
    groceryListsOf(allLists ?? []),
    listId ?? readLastGroceryList(groupSlug),
  )

  return (
    <ModuleSettingsPage moduleId="groceries">
      {allLists === undefined ? (
        <ListLoadingState label={messages.common.errors.loading} sections={1} />
      ) : list ? (
        // Keyed by list: what a switch shows while saving belongs to one list.
        <ListSettings key={list._id} list={list} />
      ) : (
        <EmptyState
          kind="nothing-yet"
          tile={{ group: 'kitchen', icon: 'ShoppingCart' }}
          title={g.web.noListTitle}
          body={g.web.noListBody}
          action={{ label: g.lists.newList, link: linkTo('groceries') }}
        />
      )}
    </ModuleSettingsPage>
  )
}

function ListSettings({ list }: { list: GroceryList }) {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const g = messages.tasks.grocery
  const errorText = useErrorMessage()
  const setSuggestions = useMutation(api.taskLists.setSuggestions)
  const [aislesOpen, setAislesOpen] = useState(false)
  // What the switch shows while its write is in flight.
  const [intended, setIntended] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const local = list.provider === 'local'
  // The dialog counts each aisle's items.
  const tasks = useQuery(
    api.tasks.listByList,
    local ? { listId: list._id, groupSlug: group.slug } : 'skip',
  )
  const suggesting = intended ?? !list.suggestionsOff

  const toggleSuggestions = async () => {
    // One write at a time, so a second press cannot overtake the first.
    if (intended !== null) return
    const on = !suggesting
    setIntended(on)
    setError(null)
    try {
      await setSuggestions({ listId: list._id, groupSlug: group.slug, on })
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    } finally {
      setIntended(null)
    }
  }

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-subhead font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      <ModuleSettingsGroup
        title={list.name}
        footer={fmt(messages.shell.modulePage.settingsSharedList, {
          list: list.name,
          group: group.name,
        })}
      >
        {local ? (
          <InsetRow
            title={g.aisleOrder.title}
            chevron
            onClick={() => setAislesOpen(true)}
          />
        ) : null}
        <InsetRow
          title={g.suggestions.title}
          switchedOn={suggesting}
          disabled={!list.writable}
          onClick={() => void toggleSuggestions()}
        />
      </ModuleSettingsGroup>
      {aislesOpen ? (
        <AisleOrderDialog
          groupSlug={group.slug}
          listId={list._id}
          listName={list.name}
          savedOrder={list.aisleOrder}
          tasks={tasks ?? []}
          onClose={() => setAislesOpen(false)}
        />
      ) : null}
    </>
  )
}
