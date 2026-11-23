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
  wash: null as unknown,
  /** What an action resolves to, by its `module:fn` name. */
  actions: {} as Record<string, unknown>,
  dismissed: [] as unknown[],
  confirms: [] as { title: string; onConfirm: () => void }[],
}

export function resetEnergyState() {
  energyState.queries = {}
  energyState.calls = []
  energyState.refuse = null
  energyState.pushes = []
  energyState.backs = 0
  energyState.wash = null
  energyState.actions = {}
  energyState.dismissed = []
  energyState.confirms = []
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
const Switch = ({ value, onValueChange, ...props }: Props) =>
  createElement('input', {
    ...common(props),
    type: 'checkbox',
    checked: Boolean(value),
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
}: {
  label: string
  onPress: () => void
  testID?: string
}) =>
  createElement(
    'button',
    { type: 'button', 'data-testid': testID, onClick: onPress },
    label,
  )
const Card = ({ children }: { children: ReactNode }) =>
  createElement('section', null, children)
const SectionLabel = ({ children }: { children: ReactNode }) =>
  createElement('h4', null, children)
const InsetList = ({ children, ...props }: Props) =>
  createElement('div', common(props), children)
const InsetRow = ({
  title,
  subtitle,
  subtitleTone,
  trailing,
  children,
  onPress,
  ...props
}: Props) =>
  createElement(
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
const Field = ({
  value,
  onChangeText,
  testID,
}: {
  value: string
  onChangeText: (text: string) => void
  testID: string
}) =>
  createElement('input', {
    'data-testid': testID,
    value,
    onChange: (event: { target: { value: string } }) =>
      onChangeText(event.target.value),
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
export const routerMock = () => ({ Stack, useRouter: () => router })
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
  hours?: unknown[]
}) {
  const rows = days.map((day) => {
    const hasData = day <= lastDay
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
      cost: null,
      costWithoutNet: null,
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
