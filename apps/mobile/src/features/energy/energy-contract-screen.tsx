/**
 * The contract and its tariffs (APP-494, designs/energy section 6).
 *
 * Amounts are typed excl. VAT, as on the contract, each in its own row with
 * its unit beside it. Prices per kWh and m³ are euros; the monthly fixed
 * costs and the yearly tax reduction are typed in euros and saved as cents.
 *
 * The latest contract is edited in place. New tariffs are a new contract from
 * the day they start, so the months before keep counting with their own:
 * "New contract from a date" starts a form prefilled from the latest, and the
 * earlier contracts are listed read-only. Net metering is a switch until
 * 2027, when it ends by law; a contract from 2027 has none.
 */
import { addDays, amsterdamIsoDate, localIsoDate, localMidnight } from '@gather/core/civil-date'
import {
  checkEnergyContract,
  ENERGY_NET_METERING_ENDS,
  type EnergyContractTerms,
  parseMeterReading,
} from '@gather/core/energy'
import { formatEnergyDate } from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useRouter } from 'expo-router'
import { useId, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DateTimeChip, DateTimeWheel } from '../../components/DateTimeField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api, type Id } from '../../convex/api'
import { useLiveQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { SectionLabel } from '../../ui/section-label'
import {
  EnergyNumberRow,
  KeyboardDoneBar,
} from './components/energy-number-row'
import { decimalsOf, editableNumber } from './energy-number-text'

type Contracts = NonNullable<FunctionReturnType<typeof api.energyContracts.list>>
type Kind = 'dynamic' | 'fixed'

type AmountKey =
  | 'importMarkup'
  | 'exportFee'
  | 'energyTax'
  | 't2'
  | 't1'
  | 'tariffExport'
  | 'gasMarkup'
  | 'gasTariff'
  | 'gasTax'
  | 'monthlyFixed'
  | 'yearlyCredit'
  | 'vat'

/** The amounts each kind of contract needs; the others may stay blank. */
const REQUIRED: Record<Kind, readonly AmountKey[]> = {
  dynamic: ['importMarkup', 'exportFee', 'energyTax', 'monthlyFixed', 'vat'],
  fixed: ['t2', 't1', 'tariffExport', 'energyTax', 'monthlyFixed', 'vat'],
}

export function EnergyContractScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const contracts = useLiveQuery(api.energyContracts.list, {
    groupSlug: group.slug,
  })
  const [creating, setCreating] = useState(false)
  const latest = contracts?.[0]
  const today = amsterdamIsoDate()

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: creating ? words.contract.newContractTitle : words.contract.title,
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {contracts === undefined ? (
          <LoadingSkeleton rows={5} label={t.actions.loading} />
        ) : contracts === null ? (
          <Text style={[TYPE.body, { color: tokens.muted }]}>
            {words.refusals.notFound}
          </Text>
        ) : (
          <>
            <ContractForm
              key={creating ? 'new' : (latest?._id ?? 'first')}
              groupSlug={group.slug}
              contractId={creating ? undefined : latest?._id}
              initial={
                latest
                  ? creating
                    ? { ...latest.terms, validFrom: today }
                    : latest.terms
                  : null
              }
              today={today}
              onSaved={() => setCreating(false)}
            />
            {latest && !creating ? (
              <Button
                variant="secondary"
                label={words.contract.newContract}
                onPress={() => setCreating(true)}
                testID="energy-contract-new"
              />
            ) : null}
            {creating ? (
              <Button
                variant="ghost"
                label={words.contract.cancelNew}
                onPress={() => setCreating(false)}
                testID="energy-contract-cancel-new"
              />
            ) : null}
            <EarlierContracts contracts={contracts} locale={locale} />
          </>
        )}
      </ScrollView>
    </>
  )
}

function EarlierContracts({
  contracts,
  locale,
}: {
  contracts: Contracts
  locale: string
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  const earlier = contracts.slice(1)
  return (
    <View style={styles.section}>
      {earlier.length > 0 ? (
        <>
          <SectionLabel>{words.contract.earlier}</SectionLabel>
          <InsetList testID="energy-contract-earlier">
            {earlier.map((contract, index) => {
              const after = contracts[index]
              const kind = words.contract[contract.terms.kind]
              const to = after ? addDays(after.terms.validFrom, -1) : null
              return (
                <InsetRow
                  key={contract._id}
                  title={
                    contract.terms.supplierName
                      ? `${contract.terms.supplierName}, ${kind.toLocaleLowerCase(locale)}`
                      : kind
                  }
                  subtitle={
                    to
                      ? fmt(words.contract.earlierRange, {
                          from: formatEnergyDate(
                            contract.terms.validFrom,
                            locale,
                            'dayMonthYear',
                          ),
                          to: formatEnergyDate(to, locale, 'dayMonthYear'),
                        })
                      : undefined
                  }
                />
              )
            })}
          </InsetList>
        </>
      ) : null}
      <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
        {words.contract.earlierHint}
      </Text>
    </View>
  )
}

function ContractForm({
  groupSlug,
  contractId,
  initial,
  today,
  onSaved,
}: {
  groupSlug: string
  contractId?: Id<'energyContracts'>
  initial: EnergyContractTerms | null
  today: string
  onSaved: () => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const save = useMutation(api.energyContracts.save)
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'dynamic')
  const [supplier, setSupplier] = useState(initial?.supplierName ?? '')
  const [validFrom, setValidFrom] = useState(initial?.validFrom ?? today)
  const [picking, setPicking] = useState(false)
  const [netMetering, setNetMetering] = useState(initial?.netMetering ?? true)
  const [texts, setTexts] = useState<Record<AmountKey, string>>(() =>
    initialTexts(initial, locale),
  )
  const [invalid, setInvalid] = useState<Set<AmountKey>>(new Set())
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const netMeteringShown = validFrom < ENERGY_NET_METERING_ENDS
  const keyboardDoneId = `energy-contract-done-${useId().replaceAll(':', '')}`

  const submit = async () => {
    const bad = new Set<AmountKey>()
    const amount = (key: AmountKey): number | undefined => {
      const text = texts[key].trim()
      if (!text) {
        if (REQUIRED[kind].includes(key)) bad.add(key)
        return undefined
      }
      const value = parseMeterReading(text)
      if (value === null) {
        bad.add(key)
        return undefined
      }
      return value
    }
    const cents = (key: AmountKey) => {
      const value = amount(key)
      return value === undefined ? undefined : Math.round(value * 100)
    }
    const terms: EnergyContractTerms = {
      validFrom,
      kind,
      supplierName: supplier.trim() || undefined,
      importMarkupEurPerKwh: kind === 'dynamic' ? (amount('importMarkup') ?? 0) : 0,
      exportFeeEurPerKwh: kind === 'dynamic' ? (amount('exportFee') ?? 0) : 0,
      energyTaxEurPerKwh: amount('energyTax') ?? 0,
      gasMarkupEurPerM3: kind === 'dynamic' ? amount('gasMarkup') : undefined,
      gasTaxEurPerM3: amount('gasTax'),
      fixedTariffs:
        kind === 'fixed'
          ? {
              t1: amount('t1') ?? 0,
              t2: amount('t2') ?? 0,
              export: amount('tariffExport') ?? 0,
              gas: amount('gasTariff') ?? 0,
            }
          : undefined,
      vatPercent: amount('vat') ?? 0,
      monthlyFixedCents: cents('monthlyFixed') ?? 0,
      yearlyTaxCreditCents: cents('yearlyCredit'),
      netMetering: netMeteringShown && netMetering,
    }
    setInvalid(bad)
    const check = bad.size > 0 ? 'invalidAmount' : checkEnergyContract(terms)
    if (check) {
      haptics.actionFailed()
      setProblem(
        check === 'invalidDate' ? words.contract.invalidDate : words.contract.invalid,
      )
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      await save({ groupSlug, contractId, terms })
      haptics.itemSaved()
      onSaved()
      if (router.canGoBack()) router.back()
      else setSaving(false)
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
      setSaving(false)
    }
  }

  const row = (key: AmountKey, label: string, unit: string, sub?: string) => (
    <EnergyNumberRow
      key={key}
      testID={`energy-contract-${key}`}
      label={label}
      sub={sub}
      unit={unit}
      value={texts[key]}
      inputAccessoryViewID={Platform.OS === 'ios' ? keyboardDoneId : undefined}
      onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
      problem={invalid.has(key) ? words.contract.invalid : null}
    />
  )
  const c = words.contract

  return (
    <View style={styles.form}>
      <Segmented<Kind>
        options={[
          { value: 'dynamic', label: c.dynamic },
          { value: 'fixed', label: c.fixed },
        ]}
        value={kind}
        onChange={setKind}
      />

      <View style={styles.section}>
        <SectionLabel>{c.groupContract}</SectionLabel>
        <InsetList>
          <EnergyNumberRow
            key="supplier"
            testID="energy-contract-supplier"
            label={c.supplier}
            unit=""
            keyboardType="default"
            wide
            maxLength={60}
            value={supplier}
            onChangeText={setSupplier}
          />
          <InsetRow
            key="validFrom"
            title={c.validFrom}
            trailing={
              <DateTimeChip
                mode="date"
                value={localMidnight(validFrom)}
                open={picking}
                onPress={() => setPicking((open) => !open)}
                accessibilityLabel={c.validFrom}
                testID="energy-contract-valid-from"
              />
            }
          />
        </InsetList>
        {picking ? (
          <DateTimeWheel
            mode="date"
            value={localMidnight(validFrom)}
            onClose={() => setPicking(false)}
            onChange={(next) => setValidFrom(localIsoDate(next))}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>{kind === 'dynamic' ? c.groupDynamic : c.groupFixed}</SectionLabel>
        <InsetList>
          {kind === 'dynamic'
            ? [
                row('importMarkup', c.importMarkup, c.unitKwh),
                row('exportFee', c.exportFee, c.unitKwh, c.exportFeeHint),
                row('energyTax', c.energyTax, c.unitKwh),
              ]
            : [
                row('t2', c.tariffT2, c.unitKwh),
                row('t1', c.tariffT1, c.unitKwh),
                row('tariffExport', c.tariffExport, c.unitKwh),
                row('energyTax', c.energyTax, c.unitKwh),
              ]}
        </InsetList>
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {c.amountsNote}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>{c.groupGas}</SectionLabel>
        <InsetList>
          {kind === 'dynamic'
            ? [
                row('gasMarkup', c.gasMarkup, c.unitM3),
                row('gasTax', c.gasTax, c.unitM3),
              ]
            : [
                row('gasTariff', c.gasTariff, c.unitM3),
                row('gasTax', c.gasTax, c.unitM3),
              ]}
        </InsetList>
      </View>

      <View style={styles.section}>
        <SectionLabel>{c.groupFixedCosts}</SectionLabel>
        <InsetList>
          {row('monthlyFixed', c.monthlyFixed, c.unitMonth)}
          {row('yearlyCredit', c.yearlyCredit, c.unitYear)}
          {row('vat', c.vat, c.unitPercent)}
        </InsetList>
      </View>

      {netMeteringShown ? (
        <InsetList>
          <InsetRow
            title={c.netMetering}
            subtitle={c.netMeteringHint}
            trailing={
              <Switch
                testID="energy-contract-net-metering"
                value={netMetering}
                accessibilityLabel={c.netMetering}
                accessibilityHint={c.netMeteringHint}
                onValueChange={(next) => {
                  haptics.selectionChanged()
                  setNetMetering(next)
                }}
                trackColor={{ false: tokens.surface2 }}
              />
            }
          />
        </InsetList>
      ) : null}

      {problem ? (
        <Text
          accessibilityRole="alert"
          testID="energy-contract-problem"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      <Button
        label={saving ? c.saving : c.save}
        group="home"
        busy={saving}
        onPress={submit}
        testID="energy-contract-save"
      />
      <KeyboardDoneBar nativeID={keyboardDoneId} />
    </View>
  )
}

/** The amounts as the form shows them: the contract's, or blanks. */
function initialTexts(
  terms: EnergyContractTerms | null,
  locale: string,
): Record<AmountKey, string> {
  const text = (value: number | undefined, max = 5) =>
    value === undefined ? '' : editableNumber(value, locale, decimalsOf(value, max))
  const euros = (cents: number | undefined) =>
    cents === undefined ? '' : editableNumber(cents / 100, locale, 2)
  return {
    importMarkup: text(terms?.importMarkupEurPerKwh),
    exportFee: text(terms?.exportFeeEurPerKwh),
    energyTax: text(terms?.energyTaxEurPerKwh),
    t2: text(terms?.fixedTariffs?.t2),
    t1: text(terms?.fixedTariffs?.t1),
    tariffExport: text(terms?.fixedTariffs?.export),
    gasMarkup: text(terms?.gasMarkupEurPerM3),
    gasTariff: text(terms?.fixedTariffs?.gas),
    gasTax: text(terms?.gasTaxEurPerM3),
    monthlyFixed: euros(terms?.monthlyFixedCents),
    yearlyCredit: euros(terms?.yearlyTaxCreditCents),
    vat: text(terms?.vatPercent ?? 21, 2),
  }
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: SPACE[4] },
  form: { gap: SPACE[5] },
  section: { gap: SPACE[2] },
  hint: { paddingHorizontal: 4 },
})
