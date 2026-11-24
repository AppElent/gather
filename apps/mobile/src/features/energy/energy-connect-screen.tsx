/**
 * Connect Home Assistant (APP-495, designs/energy section 9), for admins:
 * the address and a long-lived token, then one switch per channel its Energy
 * dashboard names. Tapping a channel picks another sensor.
 *
 * The stored token never comes back to the phone: left empty, the server
 * keeps it, and only for an unchanged address.
 */
import { MenuView } from '@expo/ui/community/menu'
import { haStatisticFits } from '@gather/core/energy'
import { energyChannelName } from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useNavigation, useRouter } from 'expo-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextInputInstance,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { UI_ICONS } from '../../theme/icons'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { Field } from '../../ui/field'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'

type SourceList = NonNullable<FunctionReturnType<typeof api.energySources.list>>
type Tested = FunctionReturnType<typeof api.energyHomeAssistant.test>
type Proposal = Tested['proposals'][number]
type ConnectNavigation = {
  addListener: (event: 'beforeRemove' | 'blur', listener: () => void) => () => void
}

export function EnergyConnectScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const list = useQuery(api.energySources.list, { groupSlug: group.slug })
  const tile = moduleTile('energy')

  return (
    <>
      <Stack.Screen options={washScreenOptions(words.connect.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: words.connect.summary,
              sub: words.connect.summarySub,
            }}
          />
        ) : null}
        <View style={styles.content}>
          {list === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : list === null ? (
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {words.empty.summary}
            </Text>
          ) : list.canManage ? (
            <ConnectForm groupSlug={group.slug} list={list} />
          ) : (
            <Text style={[TYPE.body, { color: tokens.ink }]}>
              {words.connect.adminsOnly}
            </Text>
          )}
        </View>
      </ScrollView>
    </>
  )
}

function ConnectForm({
  groupSlug,
  list,
}: {
  groupSlug: string
  list: SourceList
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const navigation = useNavigation<ConnectNavigation>()
  const router = useRouter()
  const words = t.energy
  const copy = words.connect
  const test = useAction(api.energyHomeAssistant.test)
  const connect = useAction(api.energyHomeAssistant.connect)
  const disconnect = useMutation(api.energySources.disconnect)
  const existing = list.sources.find((each) => each.kind === 'homeAssistant')
  const connected = existing?.connected ?? false
  const [address, setAddress] = useState(list.homeAssistantAddress ?? '')
  const [token, setToken] = useState('')
  const tokenRef = useRef(token)
  tokenRef.current = token
  const tokenField = useRef<TextInputInstance>(null)
  const testRun = useRef(0)
  const [tested, setTested] = useState<Tested | null>(null)
  const [history, setHistory] = useState(!connected)
  const [busy, setBusy] = useState<'test' | 'connect' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // iOS offers to save a filled secure field as a password when the screen
  // leaves, whether saved or not, so empty the native field and state first.
  const clearToken = () => {
    tokenField.current?.clear()
    setToken('')
  }
  // Parent layout-effect cleanup runs before child `TextInput` detaches its
  // internal `inputRef`, so `clear()` still reaches the native view on unmount.
  useLayoutEffect(
    () => () => {
      tokenField.current?.clear()
    },
    [],
  )
  useEffect(() => {
    const clearOnLeave = () => {
      tokenField.current?.clear()
      if (!tokenRef.current) return
      testRun.current += 1
      setToken('')
      // Any running or finished test used the pasted token that was just dropped.
      setTested(null)
      setProblem(null)
      setBusy((current) => (current === 'test' ? null : current))
    }
    const onRemove = navigation.addListener('beforeRemove', clearOnLeave)
    const onBlur = navigation.addListener('blur', clearOnLeave)
    return () => {
      onRemove()
      onBlur()
    }
  }, [navigation])

  const connection = {
    groupSlug,
    address,
    ...(token.trim() ? { token } : {}),
  }
  const stale = () => {
    testRun.current += 1
    setTested(null)
    setProblem(null)
    setBusy((current) => (current === 'test' ? null : current))
  }
  const refused = (caught: unknown) => {
    haptics.actionFailed()
    const code = readEnergyRefusal(caught)
    setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
  }
  const done = () => router.dismissTo(moduleHref('/all/energy/sources'))

  const runTest = async () => {
    Keyboard.dismiss()
    stale()
    const run = testRun.current
    setBusy('test')
    try {
      const result = await test(connection)
      if (testRun.current !== run) return
      setTested(result)
      haptics.itemSaved()
    } catch (caught) {
      if (testRun.current !== run) return
      refused(caught)
    } finally {
      if (testRun.current === run) setBusy(null)
    }
  }

  const runConnect = async () => {
    if (!tested) return
    const channels = tested.proposals.filter((each) => each.on)
    if (channels.length === 0) {
      haptics.actionFailed()
      setProblem(words.refusals.pickChannel)
      return
    }
    setBusy('connect')
    setProblem(null)
    try {
      await connect({
        ...connection,
        channels: channels.map(({ kind, tariff, statisticId }) => ({
          kind,
          ...(tariff ? { tariff } : {}),
          statisticId,
        })),
        history,
      })
      haptics.itemSaved()
      clearToken()
      requestAnimationFrame(done)
    } catch (caught) {
      refused(caught)
      setBusy(null)
    }
  }

  const runDisconnect = async () => {
    try {
      await disconnect({ groupSlug })
      clearToken()
      requestAnimationFrame(done)
    } catch (caught) {
      refused(caught)
    }
  }

  const change = (at: number, patch: Partial<Proposal>) => {
    haptics.selectionChanged()
    setTested((current) =>
      current
        ? {
            ...current,
            proposals: current.proposals.map((each, index) =>
              index === at ? { ...each, ...patch } : each,
            ),
          }
        : current,
    )
  }

  const supplied = tested?.proposals.find((each) => each.suppliedBy && !each.on)
  const ready = tested !== null && tested.proposals.length > 0

  return (
    <>
      <View style={styles.section}>
        <SectionLabel>{copy.stepConnection}</SectionLabel>
        <Field
          label={copy.address}
          value={address}
          onChangeText={(text) => {
            setAddress(text)
            stale()
          }}
          placeholder={copy.addressPlaceholder}
          keyboardType="url"
          textContentType="URL"
          autoCapitalize="none"
          autoCorrect={false}
          testID="energy-connect-address"
        />
        <Field
          ref={tokenField}
          label={copy.token}
          value={token}
          onChangeText={(text) => {
            setToken(text)
            stale()
          }}
          placeholder={connected ? copy.tokenStored : undefined}
          secure
          // Not this person's password, so nothing should offer to fill it.
          textContentType="none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          testID="energy-connect-token"
        />
        <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
          {copy.hint}
        </Text>
        <Button
          label={busy === 'test' ? copy.testing : copy.test}
          group={ready ? undefined : 'home'}
          variant={ready ? 'secondary' : 'primary'}
          busy={busy === 'test'}
          disabled={busy !== null || !address.trim()}
          onPress={runTest}
          testID="energy-connect-test"
        />
        {tested ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[TYPE.subhead, styles.note, { color: tokens.ink }]}
          >
            {tested.hasDashboard
              ? plural(locale, tested.proposals.length, {
                  one: fmt(copy.tested.one, { version: tested.version }),
                  other: fmt(copy.tested.other, { version: tested.version }),
                })
              : fmt(copy.testedNoDashboard, { version: tested.version })}
          </Text>
        ) : null}
      </View>

      {tested && ready ? (
        <View style={styles.section}>
          <SectionLabel>{copy.stepChannels}</SectionLabel>
          <InsetList testID="energy-connect-channels">
            {tested.proposals.map((proposal, index) => (
              <ChannelRow
                // A proposal keeps its place while its sensor changes.
                key={index}
                index={index}
                proposal={proposal}
                statistics={tested.statistics}
                onChange={(patch) => change(index, patch)}
              />
            ))}
          </InsetList>
          <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
            {[
              copy.channelsHint,
              supplied
                ? fmt(copy.channelsHintSupplied, {
                    channel: energyChannelName(supplied, words),
                    source: supplied.suppliedBy ?? '',
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
          <InsetList>
            <InsetRow
              title={copy.history}
              subtitle={copy.historySub}
              trailing={
                <Switch
                  testID="energy-connect-history"
                  style={styles.switch}
                  trackColor={{ false: tokens.surface2 }}
                  value={history}
                  accessibilityLabel={copy.history}
                  accessibilityHint={copy.historySub}
                  onValueChange={(next) => {
                    haptics.selectionChanged()
                    setHistory(next)
                  }}
                />
              }
            />
          </InsetList>
        </View>
      ) : null}

      {problem ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      {ready ? (
        <Button
          label={
            connected
              ? busy === 'connect'
                ? copy.saving
                : copy.save
              : busy === 'connect'
                ? copy.submitting
                : copy.submit
          }
          group="home"
          busy={busy === 'connect'}
          disabled={busy !== null}
          onPress={runConnect}
          testID="energy-connect-submit"
        />
      ) : null}
      <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
        {copy.footer}
      </Text>

      {connected ? (
        <Button
          label={copy.disconnect}
          variant="secondary"
          disabled={busy !== null}
          onPress={() =>
            confirmDestructive({
              title: copy.disconnectTitle,
              message: copy.disconnectBody,
              confirm: copy.disconnect,
              cancel: copy.cancel,
              onConfirm: () => void runDisconnect(),
            })
          }
          testID="energy-connect-disconnect"
        />
      ) : null}
    </>
  )
}

function ChannelRow({
  index,
  proposal,
  statistics,
  onChange,
}: {
  index: number
  proposal: Proposal
  statistics: Tested['statistics']
  onChange: (patch: Partial<Proposal>) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const copy = t.energy.connect
  const name = energyChannelName(proposal, t.energy)
  const note = !proposal.available
    ? copy.missing
    : proposal.suppliedBy
      ? fmt(proposal.on ? copy.replaces : copy.supplied, {
          source: proposal.suppliedBy,
        })
      : null

  return (
    <InsetRow
      testID={`energy-connect-channel-${index}`}
      trailing={
        <Switch
          testID={`energy-connect-switch-${index}`}
          style={styles.switch}
          trackColor={{ false: tokens.surface2 }}
          value={proposal.on}
          disabled={!proposal.available && !proposal.on}
          accessibilityLabel={fmt(copy.readChannel, { name })}
          accessibilityHint={note ?? undefined}
          onValueChange={(on) => onChange({ on })}
        />
      }
    >
      <MenuView
        testID={`energy-connect-sensor-${index}`}
        title={fmt(copy.pickSensor, { name })}
        shouldOpenOnLongPress={false}
        onOpenMenu={() => haptics.menuOpened()}
        actions={statistics
          .filter((each) => haStatisticFits(each, proposal.kind))
          .map((each) => ({
            id: each.id,
            title: each.id,
            subtitle: each.name ?? undefined,
            state:
              each.id === proposal.statisticId
                ? ('on' as const)
                : ('off' as const),
          }))}
        onPressAction={({ nativeEvent }) =>
          onChange({
            statisticId: nativeEvent.event,
            available: true,
            on: true,
          })
        }
      >
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${proposal.statisticId}`}
          accessibilityHint={fmt(copy.pickSensor, { name })}
          style={styles.channel}
        >
          <Text style={[TYPE.body, { color: tokens.ink }]}>{name}</Text>
          <View style={styles.sensor}>
            <Text style={[TYPE.footnote, styles.flex, { color: tokens.muted }]}>
              {proposal.statisticId}
            </Text>
            <UI_ICONS.ChevronsUpDown size={14} color={tokens.muted} />
          </View>
          {note ? (
            <Text
              style={[
                TYPE.footnote,
                { color: proposal.available ? tokens.muted : tokens.danger },
              ]}
            >
              {note}
            </Text>
          ) : null}
        </View>
      </MenuView>
    </InsetRow>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[5] },
  section: { gap: SPACE[2] },
  note: { paddingHorizontal: 4 },
  channel: { paddingVertical: SPACE[2], gap: 2, minHeight: 44 },
  sensor: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  flex: { flexShrink: 1 },
  // React Native gives every Switch `alignSelf: 'flex-start'`.
  switch: { alignSelf: 'center' },
})
