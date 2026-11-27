/**
 * The mocks Energy's screen tests share (APP-494). React Native is mocked
 * down to plain elements, as in the other rendering tests; a test file still
 * calls `vi.mock` for each module itself (Vitest hoists only those), with a
 * factory from here:
 *
 *   vi.mock('react-native', async () => (await import('./energy-test-mocks')).reactNativeMock())
 *
 * Queries answer from `energyState.queries` by function name (`module:fn`),
 * either a value or a function of the arguments; mutations are recorded in
 * `energyState.calls`.
 */
import { amsterdamDayHours } from '@gather/core/energy'
import {
  createElement,
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useRef,
} from 'react'

type Props = Record<string, unknown> & { children?: ReactNode }
type Answer = unknown | ((args: Record<string, unknown>) => unknown)

export const energyState = {
  queries: {} as Record<string, Answer>,
  calls: [] as { name: string; args: unknown }[],
  refuse: null as null | { kind: string },
  pushes: [] as unknown[],
  backs: 0,
  keyboardDismissals: 0,
  wash: null as unknown,
  /** What an action resolves to, by its `module:fn` name. */
  actions: {} as Record<string, unknown>,
  dismissed: [] as unknown[],
  confirms: [] as { title: string; onConfirm: () => void }[],
  navListeners: {} as Record<string, Set<() => void>>,
  fieldClears: [] as string[],
}

export function resetEnergyState() {
  energyState.queries = {}
  energyState.calls = []
  energyState.refuse = null
  energyState.pushes = []
  energyState.backs = 0
  energyState.keyboardDismissals = 0
  energyState.wash = null
  energyState.actions = {}
  energyState.dismissed = []
  energyState.confirms = []
  energyState.navListeners = {}
  energyState.fieldClears = []
}

/** The calls made to one mutation, by its `module:fn` name. */
export function callsTo(name: string) {
  return energyState.calls
    .filter((call) => call.name === name)
    .map((call) => call.args)
}

function answer(name: string, args: unknown) {
  if (args === 'skip') return undefined
  const value = energyState.queries[name]
  return typeof value === 'function'
    ? (value as (args: unknown) => unknown)(args)
    : value
}

function flatten(style: unknown): Record<string, unknown> {
  if (!style) return {}
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten))
  if (typeof style === 'function') return flatten(style({ pressed: false }))
  return style as Record<string, unknown>
}

function common(props: Props) {
  const style = flatten(props.style)
  const hidden =
    props.accessibilityElementsHidden === true ||
    props.importantForAccessibility === 'no-hide-descendants'
  return {
    'data-testid': props.testID as string | undefined,
    'aria-label': props.accessibilityLabel as string | undefined,
    'aria-hidden': hidden ? 'true' : undefined,
    role: props.accessibilityRole as string | undefined,
    'data-border-style': style.borderStyle as string | undefined,
    'data-border-color': style.borderColor as string | undefined,
  }
}


// The mocked components live at module level, so React keeps their state.

const View = ({ children, ...props }: Props) =>
  createElement('div', common(props), children)
const Text = ({ children, ...props }: Props) =>
  createElement('span', common(props), children)
const Pressable = ({ children, onPress, disabled, ...props }: Props) =>
  createElement(
    'button',
    {
      ...common(props),
      type: 'button',
      disabled: disabled as boolean | undefined,
      'aria-selected': (
        props.accessibilityState as { selected?: boolean } | undefined
      )?.selected,
      'aria-checked': (
        props.accessibilityState as { checked?: boolean } | undefined
      )?.checked,
      onClick: () => (onPress as (() => void) | undefined)?.(),
    },
    typeof children === 'function'
      ? (children as (state: { pressed: boolean }) => ReactNode)({ pressed: false })
      : children,
  )
const TextInput = forwardRef<{ focus: () => void }, Props>(
  function TextInput(props, ref) {
    const input = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => ({
      focus: () => input.current?.focus(),
    }))
    return createElement('input', {
      ...common(props),
      ref: input,
      value: props.value as string,
      onChange: (event: { target: { value: string } }) =>
        (props.onChangeText as ((text: string) => void) | undefined)?.(
          event.target.value,
        ),
      onBlur: () => (props.onBlur as (() => void) | undefined)?.(),
    })
  },
)
const Switch = ({ value, onValueChange, disabled, ...props }: Props) =>
  createElement('input', {
    ...common(props),
    type: 'checkbox',
    checked: Boolean(value),
    disabled: disabled as boolean | undefined,
    onChange: () =>
      (onValueChange as ((next: boolean) => void) | undefined)?.(!value),
  })
const Svg = ({ children }: Props) => createElement('svg', null, children)
const Nothing = () => null
const Stack = Object.assign(() => null, { Screen: Nothing })
const LoadingSkeleton = () => createElement('div', { 'data-testid': 'loading' })
const Button = ({
  label,
  onPress,
  testID,
  disabled,
}: {
  label: string
  onPress: () => void
  testID?: string
  disabled?: boolean
}) =>
  createElement(
    'button',
    { type: 'button', 'data-testid': testID, onClick: onPress, disabled },
    label,
  )
const Card = ({ children }: { children: ReactNode }) =>
  createElement('section', null, children)
const SectionLabel = ({ children }: { children: ReactNode }) =>
  createElement('h4', null, children)
const InsetList = ({ children, ...props }: Props) =>
  createElement('div', common(props), children)
/**
 * A row; its swipe-revealed Delete and its hold menu are buttons beside it,
 * `<testID>-swipe-delete` and `<testID>-menu-<id>`.
 */
const InsetRow = ({
  title,
  subtitle,
  subtitleTone,
  trailing,
  children,
  onPress,
  onDelete,
  deleteLabel,
  menu,
  ...props
}: Props) => {
  const row = createElement(
    onPress ? 'button' : 'div',
    {
      ...common(props),
      type: onPress ? 'button' : undefined,
      onClick: onPress as (() => void) | undefined,
    },
    createElement('span', null, title as string),
    subtitle
      ? createElement(
          'span',
          { 'data-tone': subtitleTone as string | undefined },
          subtitle as string,
        )
      : null,
    trailing as ReactNode,
    children,
  )
  if (!onDelete && !menu) return row
  const hold = menu as
    | { actions: { id: string }[]; onAction: (id: string) => void }
    | undefined
  return createElement(
    'div',
    null,
    row,
    onDelete
      ? createElement(
          'button',
          {
            type: 'button',
            'data-testid': `${props.testID as string}-swipe-delete`,
            'aria-label': deleteLabel as string,
            onClick: onDelete as () => void,
          },
          deleteLabel as string,
        )
      : null,
    hold?.actions.map((action) =>
      createElement('button', {
        type: 'button',
        key: action.id,
        'data-testid': `${props.testID as string}-menu-${action.id}`,
        onClick: () => hold.onAction(action.id),
      }),
    ),
  )
}
const Segmented = ({
  options,
  onChange,
}: {
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) =>
  createElement(
    'div',
    null,
    options.map((option) =>
      createElement(
        'button',
        {
          type: 'button',
          key: option.value,
          'data-testid': `segment-${option.value}`,
          onClick: () => onChange(option.value),
        },
        option.label,
      ),
    ),
  )
const DateTimeChip = ({
  testID,
  onPress,
}: {
  testID?: string
  onPress: () => void
}) =>
  createElement('button', {
    type: 'button',
    'data-testid': testID,
    onClick: onPress,
  })
const Field = forwardRef<
  { clear: () => void; focus: () => void },
  {
    value: string
    onChangeText: (text: string) => void
    testID: string
    secure?: boolean
    placeholder?: string
  }
>(function Field({ value, onChangeText, testID, secure, placeholder }, ref) {
  const input = useRef<HTMLInputElement>(null)
  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      clear: () => {
        // Mirror React Native TextInput's guard: native `clear()` is a no-op
        // once the child input's own ref has been detached.
        if (!input.current) return
        energyState.fieldClears.push(testID)
        input.current.value = ''
      },
    }),
    [testID],
  )
  return createElement('input', {
    ref: input,
    'data-testid': testID,
    type: secure ? 'password' : 'text',
    placeholder,
    value,
    onChange: (event: { target: { value: string } }) =>
      onChangeText(event.target.value),
  })
})
const WashHeader = ({ summary }: { summary: unknown }) => {
  energyState.wash = summary
  return null
}
const MenuView = ({
  testID,
  actions,
  onPressAction,
  children,
}: {
  testID: string
  children?: ReactNode
  actions: { id: string }[]
  onPressAction: (event: { nativeEvent: { event: string } }) => void
}) =>
  createElement(
    'div',
    { 'data-testid': testID },
    actions.map((action) =>
      createElement('button', {
        type: 'button',
        key: action.id || 'none',
        'data-testid': `${testID}-${action.id || 'none'}`,
        onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
      }),
    ),
    children,
  )

const router = {
  push: (href: unknown) => energyState.pushes.push(href),
  back: () => {
    energyState.backs += 1
  },
  canGoBack: () => true,
  dismissTo: (href: unknown) => energyState.dismissed.push(href),
}

const tokens = new Proxy(
  {},
  {
    get: (_, key) => {
      if (key === 'scheme') return 'light'
      if (key === 'tintOf') {
        return () => ({ fill: 'fill', on: 'on', text: 'text', wash: 'wash' })
      }
      return String(key)
    },
  },
)
const sizes = new Proxy({}, { get: () => 44 })

export const reactNativeMock = () => ({
  View,
  Text,
  ScrollView: View,
  Pressable,
  TextInput,
  Platform: { OS: 'ios' },
  Keyboard: {
    dismiss: () => {
      energyState.keyboardDismissals += 1
    },
  },
  InputAccessoryView: View,
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
  Switch,
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1, flatten },
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1, scale: 3 }),
})
export const svgMock = () => ({
  default: Svg,
  Svg,
  Line: Nothing,
  Polygon: Nothing,
  Polyline: Nothing,
})
export const safeAreaMock = () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
})
const navigation = {
  addListener: (event: string, listener: () => void) => {
    const set = energyState.navListeners[event] ?? new Set()
    set.add(listener)
    energyState.navListeners[event] = set
    return () => set.delete(listener)
  },
}
export const routerMock = () => ({
  Stack,
  useRouter: () => router,
  useNavigation: () => navigation,
})
const recorded = (name: string) => async (args: unknown) => {
  energyState.calls.push({ name, args })
  if (energyState.refuse) {
    throw Object.assign(new Error('refused'), { data: energyState.refuse })
  }
  return name in energyState.actions ? energyState.actions[name] : 'id1'
}
export const convexReactMock = () => ({
  useMutation: recorded,
  useAction: recorded,
})
export const confirmMock = () => ({
  confirmDestructive: (options: { title: string; onConfirm: () => void }) =>
    energyState.confirms.push(options),
})
export const apiMock = () => ({
  api: new Proxy(
    {},
    {
      get: (_, module) =>
        new Proxy({}, { get: (__, fn) => `${String(module)}:${String(fn)}` }),
    },
  ),
})
export const queriesMock = () => ({
  useQuery: answer,
  useLiveQuery: answer,
  useQueries: (requests: Record<string, { query: string; args: unknown }>) =>
    Object.fromEntries(
      Object.entries(requests).map(([id, request]) => [
        id,
        answer(request.query, request.args),
      ]),
    ),
})
export const groupMock = () => ({
  useGroup: () => ({ group: { slug: 'home', name: 'Home' } }),
})
export async function i18nMock() {
  const { en } = await import('../../i18n/messages/en')
  const { fmt, plural } = await import('@gather/core/i18n')
  return { useI18n: () => ({ t: en, locale: 'en' }), fmt, plural }
}
export const iconsMock = () => ({
  UI_ICONS: new Proxy({}, { get: () => Nothing }),
})
export const tokensMock = () => ({
  SPACE: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48],
  RADIUS: sizes,
  SIZE: sizes,
  TYPE: new Proxy({}, { get: () => ({}) }),
  TABULAR: {},
  NUMERAL_XL_MAX_SCALE: 1.5,
  useTokens: () => tokens,
})
export const hapticsMock = () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
})
export const skeletonMock = () => ({ LoadingSkeleton })
export const buttonMock = () => ({ Button })
export const cardMock = () => ({ Card })
export const sectionLabelMock = () => ({ SectionLabel })
export const insetListMock = () => ({
  InsetList,
  InsetRow,
  useInsetSeparator: () => ({}),
  useInsetRowFirst: () => true,
})
export const textScaleMock = () => ({ isAccessibilityTextSize: () => false })
export const dateTimeMock = () => ({ DateTimeChip, DateTimeWheel: Nothing })
export const moduleDestinationMock = () => ({
  moduleHref: (pathname: string, params?: Record<string, string>) =>
    params ? { pathname, params } : pathname,
})
export const fieldMock = () => ({ Field })
export const moduleTileMock = () => ({
  moduleTile: () => ({ group: 'home', glyph: {} }),
})
export const screenHeaderMock = () => ({ washScreenOptions: () => ({}) })
export const washHeaderMock = () => ({ WashHeader })
export const segmentedMock = () => ({ Segmented })
export const menuMock = () => ({ MenuView })

export const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/** Types into a controlled input, the way React hears a keystroke. */
export function typeInto(element: HTMLElement | null, text: string) {
  const input = element as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set
  setter?.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

export function blur(element: HTMLElement | null) {
  element?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
}

const CHANNELS = {
  gridImport: true,
  gridExport: false,
  solar: false,
  gas: false,
  battery: false,
  batterySoc: false,
}

/** A cost of `totalCents`, all of it for importing. */
export function costOf(totalCents: number) {
  return {
    importCents: totalCents,
    exportCents: 0,
    gasCents: 0,
    fixedCents: 0,
    creditCents: 0,
    totalCents,
  }
}

/**
 * What `energyUsage.month` or `.day` answers for a site with typed readings:
 * `kwhPerDay` on each day up to `lastDay`, nothing after.
 */
export function usagePeriod({
  days,
  lastDay,
  kwhPerDay = 10,
  hasHourly = false,
  channels = {},
  netMeteringChoice = false,
  costStatus = 'ok',
  cost = null,
  costWithoutNet = null,
  dayCost,
  costLastDay,
  hours = [],
}: {
  days: readonly string[]
  lastDay: string
  kwhPerDay?: number
  hasHourly?: boolean
  channels?: Partial<typeof CHANNELS>
  netMeteringChoice?: boolean
  costStatus?: 'ok' | 'noData' | 'noContract' | 'noPrices'
  cost?: number | null
  costWithoutNet?: number | null
  /** What each day with data costs; none by default. */
  dayCost?: (day: string) => number
  /** Days up to this one carry a cost (fixed costs reach past the readings). */
  costLastDay?: string
  hours?: unknown[]
}) {
  const rows = days.map((day) => {
    const hasData = day <= lastDay
    const priced = costLastDay ? day <= costLastDay : hasData && !!dayCost
    const dayCents = costOf(dayCost?.(day) ?? 100)
    return {
      day,
      hasData,
      estimated: !hasHourly,
      importKwh: hasData ? kwhPerDay : 0,
      exportKwh: 0,
      solarKwh: null,
      gasM3: null,
      batteryChargeKwh: 0,
      batteryDischargeKwh: 0,
      consumptionKwh: hasData ? kwhPerDay : 0,
      cost: priced ? dayCents : null,
      costWithoutNet: priced ? dayCents : null,
      costStatus,
    }
  })
  const withData = rows.filter((row) => row.hasData)
  const total = withData.length * kwhPerDay
  return {
    siteName: 'Thuis',
    hasHourly,
    channels: { ...CHANNELS, ...channels },
    contract: null,
    netMeteringChoice,
    days: rows,
    hours,
    totals: {
      importKwh: total,
      exportKwh: 0,
      solarKwh: 0,
      gasM3: 0,
      consumptionKwh: total,
      estimated: !hasHourly && withData.length > 0,
      daysWithData: withData.length,
      firstDay: withData[0]?.day ?? null,
      lastDay: withData.at(-1)?.day ?? null,
      cost: cost === null ? null : costOf(cost),
      costWithoutNet: costWithoutNet === null ? null : costOf(costWithoutNet),
      costMissingDays: 0,
      costStatus,
    },
  }
}

/** A day of prices: 30 cents, but for `changes` by hour. */
function priceDay(day: string, changes: Record<number, number>) {
  return {
    day,
    provider: 'energyzero',
    basis: 'allIn',
    terms: {
      supplierName: 'Frank Energie',
      importMarkupEurPerKwh: 0.02,
      energyTaxEurPerKwh: 0.1,
      vatPercent: 21,
    },
    exportFeeEurPerKwh: -0.01,
    hours: amsterdamDayHours(day).map((start, index) => {
      const price = changes[index] ?? 0.3
      return { start, price, market: price / 1.21 - 0.12 }
    }),
  }
}

/** What `energyPrices.view` answers on 23 November 2026. */
export function priceView(overrides: Record<string, unknown> = {}) {
  return {
    siteName: 'Thuis',
    canManage: true,
    provider: 'energyzero',
    hasKey: false,
    status: 'ok',
    lastError: null,
    lastFetchedAt: Date.parse('2026-11-23T11:40:00Z'),
    contract: { kind: 'dynamic', supplierName: 'Frank Energie' },
    today: priceDay('2026-11-23', { 2: 0.2, 3: 0.2, 4: 0.2, 13: 0.4 }),
    tomorrow: priceDay('2026-11-24', { 12: 0.1, 13: 0.1, 14: 0.1, 18: 0.5 }),
    ...overrides,
  }
}

/** 23 November 2026 with a roof and a battery, measured up to 12:00. */
export function batteryHours(now: number) {
  return amsterdamDayHours('2026-11-23').map((hourStart, index) => {
    const past = hourStart < now
    return {
      hourStart,
      hasData: past,
      importKwh: past ? 0.4 : 0,
      exportKwh: 0,
      consumptionKwh: past ? 0.4 : 0,
      solarKwh: past ? (index === 11 ? 0.95 : 0.1) : null,
      batteryChargeKwh: past ? (index === 2 || index === 3 ? 2.4 : 0) : null,
      batteryDischargeKwh: past ? (index === 8 ? 1.5 : 0) : null,
      socPercent: past ? (index === 12 ? 64 : 20 + index * 2) : null,
    }
  })
}

/** What `energySolar.month` answers on 23 November 2026. */
export function solarMonth(overrides: Record<string, unknown> = {}) {
  return {
    siteName: 'Thuis',
    status: 'ok',
    solar: true,
    battery: true,
    batterySoc: true,
    firstDay: '2026-11-23',
    assets: [],
    days: [
      {
        day: '2026-11-23',
        producedKwh: 6,
        selfUsedKwh: 4,
        returnedKwh: 2,
        selfUsedEur: 1.2,
        consumptionKwh: 20,
        ownKwh: 6.2,
        battery: {
          chargeKwh: 4.8,
          dischargeKwh: 3,
          chargeEur: 0.96,
          dischargeEur: 1.55,
        },
        solarEur: 1.4,
        batteryEur: 0.59,
      },
    ],
    ...overrides,
  }
}
