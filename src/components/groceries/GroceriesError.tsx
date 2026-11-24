import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import { ListErrorState } from '../app/ListDetailLayout'

/** What a Groceries route shows when one of its queries is refused or fails. */
export function GroceriesError({ reset }: ErrorComponentProps) {
  const words = useMessages().tasks.grocery.web
  const router = useRouter()
  return (
    <div className="mx-auto grid max-w-6xl">
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
