import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import { ListErrorState } from '../app/ListDetailLayout'
import { WashHeader } from '../app/WashHeader'

/** What Shared costs shows when one of its queries is refused or fails. */
export function SharedCostsError({ reset }: ErrorComponentProps) {
  const messages = useMessages()
  const words = messages.finances.split.web
  const router = useRouter()
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4">
      <WashHeader
        group="money"
        icon="Users"
        title={messages.modules.byId['shared-costs'].label}
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
