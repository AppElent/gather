import { useAuth, useClerk, useOrganization } from '@clerk/clerk-react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { MODULES, type SpaceModuleState } from '../../lib/modules'
import { getVisibleModuleIds } from '../../lib/spaceModules'

type SpaceSummary = { slug: string; clerkOrganizationId: string }
type SpaceContext = {
  modules: readonly { moduleId: string; state: SpaceModuleState }[]
}
type SpaceApi = { spaces: { mine: unknown; context: unknown } }

const spaceApi = api as unknown as SpaceApi
const useSpaceQuery = useQuery as unknown as (
  reference: unknown,
  args?: unknown,
) => unknown

const legacyModuleRoutes = new Map([
  ['/recipes', { moduleId: 'recipes', to: '/s/$spaceSlug/recipes' }],
  ['/modules/recipes', { moduleId: 'recipes', to: '/s/$spaceSlug/recipes' }],
  ['/tasks', { moduleId: 'tasks' }],
  ['/calendar', { moduleId: 'calendar' }],
  ['/notes', { moduleId: 'notes' }],
  ['/meal-planner', { moduleId: 'meal-planner' }],
  ['/groceries', { moduleId: 'groceries' }],
  ['/pantry', { moduleId: 'pantry' }],
  ['/finances', { moduleId: 'finances' }],
  ['/bills', { moduleId: 'bills' }],
  ['/cheeses', { moduleId: 'cheeses' }],
  ['/wines', { moduleId: 'wines' }],
])

function normalizeLegacyPath(path: string) {
  const normalized = path.split('#')[0].replace(/\/+$/, '')
  return normalized || '/dashboard'
}

export function legacySpaceRedirectDestination({
  from,
  spaceSlug,
  visibleModuleIds,
}: {
  from: string
  spaceSlug: string
  visibleModuleIds: readonly string[]
}) {
  const legacyModule = legacyModuleRoutes.get(normalizeLegacyPath(from))
  if (legacyModule?.to && visibleModuleIds.includes(legacyModule.moduleId)) {
    return {
      to: legacyModule.to,
      params: { spaceSlug },
      replace: true,
    }
  }

  if (legacyModule) {
    return {
      to: '/s/$spaceSlug/modules' as const,
      params: { spaceSlug },
      replace: true,
    }
  }

  return {
    to: '/s/$spaceSlug/home' as const,
    params: { spaceSlug },
    replace: true,
  }
}

export function LegacySpaceRedirect({ from }: { from: string }) {
  const navigate = useNavigate()
  const { organization } = useOrganization()
  const { setActive } = useClerk()
  const { getToken } = useAuth()
  const spaces = useSpaceQuery(spaceApi.spaces.mine) as
    | readonly SpaceSummary[]
    | undefined
  const activeSpace = spaces?.find(
    (space) => space.clerkOrganizationId === organization?.id,
  )
  const targetSpace = activeSpace ?? spaces?.[0]
  const targetOrganizationId = targetSpace?.clerkOrganizationId
  const targetIsActive = targetOrganizationId === organization?.id
  const [tokenReadyForOrganization, setTokenReadyForOrganization] = useState<
    string | null
  >(null)
  const [activationError, setActivationError] = useState<string | null>(null)

  useEffect(() => {
    if (!targetOrganizationId || targetIsActive) return
    setActivationError(null)
    void setActive({ organization: targetOrganizationId }).catch((error) => {
      setActivationError(
        error instanceof Error
          ? error.message
          : 'Could not activate this Space',
      )
    })
  }, [setActive, targetIsActive, targetOrganizationId])

  useEffect(() => {
    if (!targetOrganizationId || !targetIsActive) {
      setTokenReadyForOrganization(null)
      return
    }
    let cancelled = false
    setTokenReadyForOrganization(null)
    void getToken({ template: 'convex', skipCache: true })
      .then(() => {
        if (!cancelled) setTokenReadyForOrganization(targetOrganizationId)
      })
      .catch((error) => {
        if (!cancelled) {
          setActivationError(
            error instanceof Error
              ? error.message
              : 'Could not refresh Space access',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [getToken, targetIsActive, targetOrganizationId])

  const context = useSpaceQuery(
    spaceApi.spaces.context,
    targetSpace && tokenReadyForOrganization === targetOrganizationId
      ? { spaceSlug: targetSpace.slug }
      : 'skip',
  ) as SpaceContext | undefined
  const visibleModuleIds = context
    ? getVisibleModuleIds(MODULES, context.modules)
    : []

  useEffect(() => {
    if (spaces === undefined) return
    if (!targetSpace) {
      void navigate({ to: '/onboarding', replace: true })
      return
    }
    if (
      activationError ||
      !targetIsActive ||
      tokenReadyForOrganization !== targetOrganizationId ||
      context === undefined
    )
      return
    void navigate(
      legacySpaceRedirectDestination({
        from,
        spaceSlug: targetSpace.slug,
        visibleModuleIds,
      }),
    )
  }, [
    activationError,
    context,
    from,
    navigate,
    spaces,
    targetIsActive,
    targetOrganizationId,
    targetSpace,
    tokenReadyForOrganization,
    visibleModuleIds,
  ])

  return (
    <div className="app-shell grid min-h-svh place-items-center text-sm text-[var(--app-muted)]">
      {activationError ?? 'Opening your Space...'}
    </div>
  )
}
