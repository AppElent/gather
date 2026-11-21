/**
 * The Energy Module (APP-492): the Group's address, or the way to add one.
 *
 * Empty, the wash says there is no address yet and the screen says what the
 * Module is for, with one step: adding an address (ADR-0022). That step opens
 * the form in place, as `designs/energy/Main.dc.html` draws it: a name, an
 * optional House from Finances and how the data comes in. Choosing meter
 * readings saves that source with the address; Home Assistant is connected on
 * its own screen later (APP-495), so choosing it saves the address alone.
 *
 * With an address, the screen is the shell the next issues fill: the wash
 * names the address and its source, and a card says what is coming.
 */
import { MenuView } from '@expo/ui/community/menu'
import { checkEnergySiteName, ENERGY_LIMITS } from '@gather/core/energy'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Field } from '../../ui/field'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'

type SourceChoice = 'homeAssistant' | 'manual'

export function EnergyScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const overview = useQuery(api.energy.overview, { groupSlug: group.slug })
  const [adding, setAdding] = useState(false)
  const tile = moduleTile('energy')

  const summary =
    overview === null
      ? { count: words.empty.summary, sub: words.empty.sub }
      : overview
        ? {
            count: overview.site.name,
            sub:
              overview.sources.length === 0
                ? words.site.sourceNone
                : overview.sources.map((source) => source.label).join(' · '),
          }
        : null

  return (
    <>
      <Stack.Screen options={washScreenOptions(t.modules.byId.energy.label)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && summary ? (
          <WashHeader group={tile.group} glyph={tile.glyph} summary={summary} />
        ) : null}
        <View style={styles.content}>
          {overview === undefined ? (
            <LoadingSkeleton rows={3} label={t.actions.loading} />
          ) : overview ? (
            <Card style={styles.note}>
              <Text
                accessibilityRole="header"
                style={[TYPE.bodyStrong, { color: tokens.ink }]}
              >
                {words.site.nextTitle}
              </Text>
              <Text style={[TYPE.subhead, { color: tokens.muted }]}>
                {overview.sources.some((source) => source.kind === 'manual')
                  ? words.site.nextManual
                  : words.site.nextHomeAssistant}
              </Text>
            </Card>
          ) : adding ? (
            <AddressForm groupSlug={group.slug} />
          ) : (
            <Card style={styles.intro}>
              <Text
                accessibilityRole="header"
                style={[TYPE.title3, { color: tokens.ink }]}
              >
                {words.empty.title}
              </Text>
              <Text style={[TYPE.body, { color: tokens.ink }]}>
                {words.empty.body}
              </Text>
              <Text style={[TYPE.subhead, { color: tokens.muted }]}>
                {words.empty.next}
              </Text>
              <Button
                label={words.empty.action}
                group="home"
                onPress={() => setAdding(true)}
                testID="energy-add-first"
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </>
  )
}

function AddressForm({ groupSlug }: { groupSlug: string }) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  const houses = useQuery(api.houses.list, { groupSlug })
  const createSite = useMutation(api.energy.createSite)
  const [name, setName] = useState(words.form.defaultName)
  const [houseId, setHouseId] = useState<Id<'houses'> | null>(null)
  const [source, setSource] = useState<SourceChoice>('homeAssistant')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const house = houses?.find((each) => each._id === houseId)

  const submit = async () => {
    const checked = checkEnergySiteName(name)
    if ('problem' in checked) {
      haptics.actionFailed()
      setProblem(words.refusals[checked.problem])
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      await createSite({
        groupSlug,
        name: checked.name,
        houseId: houseId ?? undefined,
        source:
          source === 'manual'
            ? { kind: 'manual', label: words.site.manualSourceLabel }
            : { kind: 'homeAssistant' },
      })
      haptics.itemSaved()
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
      setSaving(false)
    }
  }

  const options: { value: SourceChoice; label: string; hint: string }[] = [
    {
      value: 'homeAssistant',
      label: words.form.homeAssistant,
      hint: words.form.homeAssistantHint,
    },
    { value: 'manual', label: words.form.manual, hint: words.form.manualHint },
  ]

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <SectionLabel>{words.form.addressHeading}</SectionLabel>
        <Field
          label={words.form.name}
          value={name}
          onChangeText={setName}
          maxLength={ENERGY_LIMITS.siteName}
          autoCapitalize="sentences"
          returnKeyType="done"
          testID="energy-name"
        />
        <MenuView
          testID="energy-house-menu"
          title={words.form.house}
          shouldOpenOnLongPress={false}
          onOpenMenu={() => haptics.menuOpened()}
          actions={[
            {
              id: '',
              title: words.form.houseNone,
              state: houseId === null ? ('on' as const) : ('off' as const),
            },
            ...(houses ?? []).map((each) => ({
              id: each._id,
              title: each.name,
              state: each._id === houseId ? ('on' as const) : ('off' as const),
            })),
          ]}
          onPressAction={({ nativeEvent }) => {
            const picked = houses?.find(
              (each) => each._id === nativeEvent.event,
            )
            setHouseId(picked ? picked._id : null)
          }}
        >
          <View
            accessibilityRole="button"
            accessibilityLabel={`${words.form.house}, ${house?.name ?? words.form.houseNone}`}
            style={[
              styles.picker,
              { backgroundColor: tokens.surface, borderColor: tokens.hair },
            ]}
          >
            <Text style={[TYPE.body, styles.flex, { color: tokens.ink }]}>
              {words.form.house}
            </Text>
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {house?.name ?? words.form.houseNone}
            </Text>
            <UI_ICONS.ChevronsUpDown size={16} color={tokens.muted} />
          </View>
        </MenuView>
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.form.houseHint}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>{words.form.sourceHeading}</SectionLabel>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={words.form.sourceLabel}
          style={styles.options}
        >
          {options.map((option) => {
            const selected = source === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${option.label}. ${option.hint}`}
                testID={`energy-source-${option.value}`}
                onPress={() => {
                  haptics.selectionChanged()
                  setSource(option.value)
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: selected ? tokens.accent : tokens.hair,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? tokens.accent : tokens.muted },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[styles.radioDot, { backgroundColor: tokens.accent }]}
                    />
                  ) : null}
                </View>
                <View style={styles.flex}>
                  <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
                    {option.label}
                  </Text>
                  <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                    {option.hint}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {problem ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      <Button
        label={saving ? words.form.saving : words.form.submit}
        group="home"
        busy={saving}
        onPress={submit}
        testID="energy-submit"
      />
      <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
        {words.form.footnote}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  intro: { gap: SPACE[3], paddingVertical: SPACE[4] },
  note: { gap: SPACE[1], paddingVertical: SPACE[3] },
  form: { gap: SPACE[5] },
  section: { gap: SPACE[2] },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: { paddingHorizontal: 4 },
  options: { gap: SPACE[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE[3],
    padding: 14,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
})
