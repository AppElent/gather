/**
 * The signed-in root stack.
 *
 * The tab bar stays fixed across Groups (ADR-0015). Profile owns Settings,
 * Account and Groups inside its tab stack (ADR-0018), so a permanent destination
 * keeps the bar available.
 *
 * Three gates, outermost first: Clerk decides whether you are here at all,
 * Convex decides whether anything may query (`ConvexSessionGate`), and the
 * Group decides what everything is scoped to. Account deletion sits above the
 * last two, because its first step takes both away while its second is still
 * running (`AccountDeleteProvider`).
 */
import { useAuth } from '@clerk/expo'
import { Redirect, Stack, useNavigationContainerRef } from 'expo-router'
import { type ReactNode, useCallback } from 'react'

import { ConvexSessionGate } from '../../src/auth/ConvexSessionGate'
import { useSignOut } from '../../src/auth/useSignOut'
import { GroupPending } from '../../src/components/GroupPending'
import { NoGroup } from '../../src/components/NoGroup'
import { DropGate } from '../../src/drop/DropGate'
import { AccountDeleteProvider } from '../../src/features/account/delete/account-delete-provider'
import { AccountDeleteUnderwayScreen } from '../../src/features/account/delete/account-delete-underway-screen'
import { PushPermissionProvider } from '../../src/features/notifications/push/push-permission-provider'
import { PushTaskDone } from '../../src/features/notifications/push/push-task-done'
import { GroupProvider } from '../../src/group/GroupProvider'
import { groupUnwindActions, type NavState } from '../../src/group/groupUnwind'
import { useI18n } from '../../src/i18n'
import { showAlert } from '../../src/observability/native-presentation'
import {
  hasPresentedRoute,
  useShakeToReportBlocker,
} from '../../src/observability/shake-to-report'
import { useTokens } from '../../src/theme/tokens'

export const unstable_settings = { anchor: '(tabs)' }

// A shake must not open the report form under a presented route (APP-439).
function ShakeToReportGate({
  blocked,
  children,
}: {
  blocked: boolean
  children: ReactNode
}) {
  useShakeToReportBlocker(blocked)
  return children
}

export default function AppLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()
  const signOut = useSignOut()
  const { t } = useI18n()
  const navigation = useNavigationContainerRef()
  // ADR-0015: a switch unwinds every Group-scoped tab stack. By resetting
  // their state, not by re-keying them — that crashes Android (#235).
  const unwindTabStacks = useCallback(() => {
    const state = navigation.getRootState() as NavState | undefined
    for (const action of groupUnwindActions(state)) navigation.dispatch(action)
  }, [navigation])

  // Signing out unmounts all of this, so the confirmation is an alert, which
  // outlives it and lands on the welcome screen (APP-397).
  const sayGatherDataDeleted = useCallback(() => {
    const words = t.account.deleteAccount.dataOnly
    showAlert(words.doneTitle, words.doneBody)
  }, [t])

  if (!isSignedIn) return <Redirect href="/" />

  return (
    <AccountDeleteProvider
      onGatherDataDeleted={sayGatherDataDeleted}
      underway={({ state, retryLogin }) => (
        <AccountDeleteUnderwayScreen
          state={state}
          retryLogin={retryLogin}
          onSignOut={signOut}
        />
      )}
    >
      <ConvexSessionGate pending={<GroupPending />} onSignOut={signOut}>
        {/* Asks nothing at launch; registers this phone's token when allowed. */}
        <PushPermissionProvider>
        {/* A task reminder's Done button (APP-305). */}
        <PushTaskDone />
        <GroupProvider
          pending={<GroupPending />}
          none={<NoGroup onSignOut={signOut} />}
          onSwitch={unwindTabStacks}
        >
          {/* Inside both gates, because the chooser needs the Group and needs this
              stack to be pushed onto. The Drop itself was captured further up. */}
          <DropGate />
          <Stack
            layout={({ state, descriptors, children }) => (
              <ShakeToReportGate
                blocked={hasPresentedRoute(state, descriptors)}
              >
                {children}
              </ShakeToReportGate>
            )}
            screenOptions={{
              headerShown: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: tokens.ground },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="deep-link" />
            <Stack.Screen name="drop" />
          </Stack>
        </GroupProvider>
        </PushPermissionProvider>
      </ConvexSessionGate>
    </AccountDeleteProvider>
  )
}
