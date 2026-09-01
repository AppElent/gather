import { landingGroupId } from '@gather/core/groups'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useMemo, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import { groupLink } from '../../lib/groupPaths'
import { legacyTarget } from '../../lib/legacyPaths'

/**
 * The one page that arrives without a Group and has to find one.
 *
 * Two routes render it: `/`, where nobody has said anything yet, and the splat
 * that catches every address written before ADR-0002. They are the same job —
 * work out which page was meant, work out which Group to read it in, and go
 * there — so they are one component.
 *
 * It reads the URL, which pages under a Group are told never to do. The
 * difference is that this *is* the URL's page: there is nothing else here, and
 * what it does with the answer is replace it with an address that says the
 * Group out loud. Nothing is stored on the way past.
 */
/**
 * How long an empty list of Groups is treated as one that has not finished
 * arriving. Long enough for `ensureUser` to insert a Personal group and for the
 * query to push the new answer back; short enough that a genuinely group-less
 * account is not left watching a message about going somewhere.
 */
const EMPTY_GRACE_MS = 5000

export function LandingRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const groups = useQuery(api.groups.myGroups)

  const { pathname, hash, search } = location
  // Rebuilt only when the address changes, so the effect below is not chasing a
  // new object every render.
  const target = useMemo(() => legacyTarget(pathname), [pathname])
  const sent = useRef(false)

  useEffect(() => {
    // One redirect, decided from the address that was actually typed.
    //
    // `useLocation` is a subscription to the router, not to this route: the
    // moment the redirect below starts, `pathname` here becomes the *new*
    // address while this component is still mounted waiting to be replaced.
    // Reading a legacy path out of that gives null — `/g/<slug>/recipes` is
    // nobody's old bookmark — and the second pass would quietly overwrite the
    // right destination with Home. Which is exactly what it did: every legacy
    // path landed on Home, and only the paths whose equivalent *is* Home
    // looked correct.
    if (sent.current) return

    // Still asking. Guessing a Group here would mean redirecting twice and
    // showing the wrong Group's Home in between.
    if (groups === undefined) return

    const groupId = landingGroupId(groups)
    const group = groups.find((candidate) => candidate._id === groupId)
    if (!group) {
      // An empty list usually means "not yet" rather than "none": `ensureUser`
      // creates everybody's Personal group on the same mount that renders this,
      // so on a first-ever visit the answer arrives empty and fills in a
      // round-trip later. Sending a new arrival to the Groups list on that
      // basis would greet them with a page about not being anywhere, moments
      // before they were somewhere. Wait for the query to say otherwise —
      // it is reactive, so it will.
      //
      // Not forever, though: a person whose Personal group has gone missing
      // would wait on a Group that is never coming, and `ensureUser` only
      // creates one alongside a new `users` row. After the grace period the
      // Groups list is the honest answer after all.
      const settle = setTimeout(() => {
        sent.current = true
        void navigate({ to: '/groups', replace: true })
      }, EMPTY_GRACE_MS)
      return () => clearTimeout(settle)
    }

    sent.current = true

    const link = target
      ? target.link(group.slug)
      : groupLink('home', group.slug)
    void navigate({
      ...link,
      search,
      // A fragment names a place on the page and survives the move. TanStack
      // stores it without the '#', and an empty one must stay absent rather
      // than become a bare '#'.
      hash: hash === '' ? undefined : hash,
      // The address people typed is not a step in their history: going back
      // from where they land should leave the app, not bounce off this page
      // and forward again.
      replace: true,
    })
  }, [groups, target, hash, search, navigate])

  return (
    <p className="py-16 text-center text-sm text-[var(--app-muted)]">
      Taking you there…
    </p>
  )
}
