import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import { ListErrorState } from '../app/ListDetailLayout'
import { WashHeader } from '../app/WashHeader'

/** What a Groceries route shows when one of its queries is refused or fails. */
export function GroceriesError({ reset }: ErrorComponentProps) {
  const messages = useMessages()
  const words = messages.tasks.grocery.web
  const router = useRouter()
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4">
      <WashHeader
        group="kitchen"
        icon="ShoppingCart"
        title={messages.modules.byId.groceries.label}
      />
      <ListErrorState
        title={words.loadErrorTitle}
        body={words.loadErrorBody}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
