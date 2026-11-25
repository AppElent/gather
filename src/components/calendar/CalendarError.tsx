import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import { ListErrorState } from '../app/ListDetailLayout'
import { WashHeader } from '../app/WashHeader'

/** What a Calendar route shows when one of its queries is refused or fails. */
export function CalendarError({ reset }: ErrorComponentProps) {
  const messages = useMessages()
  const words = messages.calendar.web
  const router = useRouter()
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4">
      <WashHeader
        group="home"
        icon="Calendar"
        title={messages.modules.byId.calendar.label}
      />
      <ListErrorState
        title={words.errorTitle}
        body={words.errorBody}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
