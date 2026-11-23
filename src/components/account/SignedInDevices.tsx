import { useSession, useUser } from '@clerk/react'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'

interface Row {
  id: string
  device: string
  where: string | null
  lastActive: Date
  current: boolean
  revoke: () => Promise<unknown>
}

/**
 * The Account page's "Signed-in devices": the phone's Devices screen
 * (`apps/mobile/app/(app)/(tabs)/settings/account/devices.tsx`) in a section,
 * with its words and rules.
 *
 * The session you are holding is in the list and is not revocable from itself:
 * that is what Sign out already is. Revoking is permanent, so it asks first and
 * names the device. The list is Clerk's and is fetched rather than subscribed
 * to, so it reloads after a revoke instead of hoping.
 */
export function SignedInDevices() {
  const { messages, locale } = useI18n()
  const words = messages.settings.signedInDevices
  const { user } = useUser()
  const { session } = useSession()
  const { confirm, dialog } = useConfirmAction()
  // A revoked session's phone stops getting this account's notifications.
  const forgetEnded = useMutation(api.notifications.forgetEndedSessions)

  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

  /** Loads the list; resolves to the active session ids, or null on failure. */
  const load = useCallback(async (): Promise<string[] | null> => {
    if (!user) return null
    try {
      const sessions = await user.getSessions()
      setFailed(false)
      setRows(
        sessions.map((s) => ({
          id: s.id,
          device:
            [s.latestActivity?.browserName, s.latestActivity?.deviceType]
              .filter(Boolean)
              .join(' · ') || words.unknownDevice,
          where:
            [s.latestActivity?.city, s.latestActivity?.country]
              .filter(Boolean)
              .join(', ') || null,
          lastActive: s.lastActiveAt,
          current: s.id === session?.id,
          revoke: () => s.revoke(),
        })),
      )
      return sessions.map((s) => s.id)
    } catch {
      setFailed(true)
      return null
    }
  }, [user, session?.id, words.unknownDevice])

  useEffect(() => {
    void load()
  }, [load])

  function ask(row: Row) {
    confirm({
      title: fmt(words.revokeTitle, { device: row.device }),
      body: words.revokeBody,
      confirmLabel: words.signOutOf,
      errorFallback: words.failed,
      run: async () => {
        await row.revoke()
        const active = await load()
        if (active)
          await forgetEnded({
            activeSessionIds: active,
            endedSessionIds: [row.id],
          }).catch(() => {})
      },
    })
  }

  return (
    <>
      <section aria-labelledby="signed-in-devices-title" className="rm-panel p-4">
        <h2 id="signed-in-devices-title" className="rm-label">
          {words.title}
        </h2>
        <p className="m-0 mb-3 text-sm text-[var(--muted)]">
          {words.description}
        </p>

        {failed ? (
          <p
            role="alert"
            className="m-0 mb-3 rounded-[var(--radius-control)] border border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {words.failed}
          </p>
        ) : null}

        {rows === null ? (
          failed ? null : (
            <p className="m-0 text-sm text-[var(--muted)]">
              {messages.common.errors.loading}
            </p>
          )
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--hair)] rounded-[var(--radius-control)] border border-[var(--hair)] p-0">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex min-h-12 items-center gap-3 px-3 py-2"
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-semibold">
                    {row.current ? words.thisDevice : row.device}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {[
                      row.where,
                      fmt(words.lastActive, {
                        when: row.lastActive.toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                        }),
                      }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {row.current ? null : (
                  <button
                    type="button"
                    data-testid={`account-revoke-${row.id}`}
                    aria-label={fmt(words.revokeTitle, { device: row.device })}
                    onClick={() => ask(row)}
                    className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-control)] border border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] px-3 text-sm font-semibold text-[var(--danger)]"
                  >
                    {words.signOutOf}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Outside the panel: its backdrop-filter would make it the containing
          block of the dialog's fixed overlay, trapping it inside the card. */}
      {dialog}
    </>
  )
}
