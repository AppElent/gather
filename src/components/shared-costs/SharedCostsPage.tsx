import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { ListLoadingState } from '../app/ListDetailLayout'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import { WashHeader } from '../app/WashHeader'
import { useCloseOnEscape } from '../tasks/useCloseOnEscape'
import { PaymentDialog } from './PaymentDialog'
import { SaveDialog } from './SaveDialog'
import { SavedSplitList, SavedSplitMissing, SavedSplitView } from './SavedSplits'
import { SplitCalculator } from './SplitCalculator'
import { OutcomeBar, SplitOutcome } from './SplitOutcome'
import {
  duplicateOf,
  EMPTY_DRAFT,
  isBlank,
  newPayment,
  outcomeOf,
  type Person,
  peopleOf,
  type SavedSplit,
  type SplitDraft,
  savePayload,
} from './splitDraft'

/**
 * Shared costs on the web (APP-329): the phone's split calculator (ADR-0025).
 *
 * Every figure lives in component state, so leaving the page loses it, on
 * purpose. Saving is the exception, and a saved split is immutable. Another
 * Group is another household's money, so the draft does not follow the switch.
 */
export function SharedCostsPage({ openSplitId }: { openSplitId?: string }) {
  const { slug } = useRequiredCurrentGroup()
  return <SharedCosts key={slug} openSplitId={openSplitId} />
}

function SharedCosts({ openSplitId }: { openSplitId?: string }) {
  const { slug: groupSlug, timeZone } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const { disclaimer, split: words } = messages.finances
  const moduleLabel = messages.modules.byId['shared-costs'].label
  const desktop = useIsDesktop()
  const navigate = useNavigate()

  const members = useQuery(api.groups.members, { slug: groupSlug })
  const saved = useQuery(api.splitScenarios.list, { groupSlug })
  const save = useMutation(api.splitScenarios.save)
  const { confirm, dialog } = useConfirmAction()

  const [draft, setDraft] = useState<SplitDraft>(EMPTY_DRAFT)
  const [sheet, setSheet] = useState<'payment' | 'save' | null>(null)
  const whatRef = useRef<HTMLInputElement>(null)
  const sideRef = useRef<HTMLDivElement>(null)
  const recordRef = useRef<HTMLElement>(null)

  const roster = useMemo<Person[]>(
    () =>
      (members ?? []).map(({ userId, name }) => ({ id: userId, name, userId })),
    [members],
  )
  const people = useMemo(() => peopleOf(roster, draft), [roster, draft])
  const outcome = useMemo(() => outcomeOf(draft, people), [draft, people])

  const open = openSplitId !== undefined
  const openSplit = saved?.find((split) => split._id === openSplitId)
  const close = () => void navigate({ ...linkTo('shared-costs'), search: {} })
  useCloseOnEscape(open, close)

  // Opening a split moves focus to it; closing gives it back to its row.
  const wasOpen = useRef(openSplitId)
  useEffect(() => {
    const before = wasOpen.current
    if (before === openSplitId) return
    wasOpen.current = openSplitId
    if (openSplitId) {
      recordRef.current?.focus({ preventScroll: desktop })
      return
    }
    const active = document.activeElement
    if (active && active !== document.body) return
    sideRef.current
      ?.querySelector<HTMLElement>(`a[href*="${before}"]`)
      ?.focus({ preventScroll: true })
  }, [openSplitId, desktop])

  /** Puts another calculation in place of this one, asking if it has figures. */
  function replaceWith(next: SplitDraft) {
    const apply = () => {
      setDraft(next)
      if (open) close()
      // After the dialog or the record has given focus back.
      window.setTimeout(() => whatRef.current?.focus(), 0)
    }
    if (isBlank(draft)) apply()
    else
      confirm({
        title: words.web.replaceTitle,
        body: words.web.replaceBody,
        confirmLabel: words.web.replace,
        run: apply,
      })
  }

  const duplicate = (split: SavedSplit) =>
    replaceWith(duplicateOf(split, roster, locale))

  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !open) return
    event.preventDefault()
    close()
  }

  const loading = members === undefined || saved === undefined
  const recordPage = open && !desktop
  const hasAnswer = draft.payments.length > 0

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbling from the page closes the open split
    <div
      onKeyDown={onEscape}
      className={`mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 ${
        hasAnswer && !open ? 'max-md:pb-24' : ''
      }`}
    >
      {recordPage ? (
        <Breadcrumbs
          className="-mb-1"
          trail={[
            { label: moduleLabel, link: linkTo('shared-costs') },
            { label: openSplit?.name ??
                (loading ? words.saved : words.web.missingTitle) },
          ]}
        />
      ) : (
        <WashHeader
          group="money"
          icon="Users"
          title={moduleLabel}
          summary={{ count: words.web.summary, scope: words.web.summaryScope }}
          primary={{
            label: words.web.newSplit,
            onClick: () => replaceWith(EMPTY_DRAFT),
          }}
        />
      )}

      {loading ? (
        <ListLoadingState label={words.web.loading} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 ${
              open ? 'max-lg:hidden' : ''
            }`}
          >
            <p className="m-0 rounded-[16px] bg-[var(--surface)] px-4 py-3 text-subhead text-[var(--muted)] max-lg:hidden">
              {words.notice}
            </p>
            <SplitCalculator
              draft={draft}
              onChange={setDraft}
              people={people}
              outcome={outcome}
              onAddPayment={() => setSheet('payment')}
              whatRef={whatRef}
            />
          </div>

          <div
            ref={sideRef}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5"
          >
            {open ? (
              <aside
                ref={recordRef}
                tabIndex={-1}
                aria-label={openSplit?.name ?? words.web.missingTitle}
                className="min-w-0 rounded-[var(--radius-card)] bg-[var(--surface)] outline-none"
              >
                {openSplit ? (
                  <SavedSplitView
                    split={openSplit}
                    timeZone={timeZone}
                    level={desktop ? 2 : 1}
                    onClose={desktop ? close : undefined}
                    onDuplicate={() => duplicate(openSplit)}
                  />
                ) : (
                  <SavedSplitMissing level={desktop ? 2 : 1} />
                )}
              </aside>
            ) : (
              <SplitOutcome
                draft={draft}
                outcome={outcome}
                people={people}
                onSave={() => setSheet('save')}
              />
            )}
            <div className={`grid gap-4 ${open ? 'max-lg:hidden' : ''}`}>
              <SavedSplitList
                splits={saved}
                openId={openSplitId}
                timeZone={timeZone}
              />
              <p className="mx-1 my-0 text-footnote text-[var(--muted)] lg:hidden">
                {words.notice}
              </p>
              <p className="mx-1 my-0 text-footnote text-[var(--muted)]">
                {disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && hasAnswer && !open ? (
        <OutcomeBar
          draft={draft}
          outcome={outcome}
          onSave={() => setSheet('save')}
        />
      ) : null}

      {sheet === 'payment' ? (
        <PaymentDialog
          people={people}
          onClose={() => setSheet(null)}
          onAdd={(payment) => {
            setDraft((current) => ({
              ...current,
              payments: [...current.payments, newPayment(current, payment)],
            }))
            setSheet(null)
          }}
        />
      ) : null}
      {sheet === 'save' ? (
        <SaveDialog
          suggestedName={draft.what.trim()}
          onClose={() => setSheet(null)}
          onSave={(name) =>
            save(savePayload(groupSlug, name, draft, outcome, people))
          }
        />
      ) : null}
      {dialog}
    </div>
  )
}
