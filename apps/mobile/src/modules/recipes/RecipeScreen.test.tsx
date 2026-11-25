// @vitest-environment jsdom
/**
 * The recipe source link opens in the in-app browser and alerts when the
 * browser cannot open it (APP-846).
 */
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { RecipeScreen } from './RecipeScreen'

type Props = Record<string, unknown> & { children?: ReactNode }

const SOURCE_URL = 'https://www.bbcgoodfood.com/recipes/pasta'

const state = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'nl',
  openBrowser: vi.fn(),
  alert: vi.fn(),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    View: box,
    Text: box,
    ScrollView: box,
    Pressable: ({ children, ...props }: Props) =>
      h(
        'button',
        {
          'data-testid': props.testID as string,
          'aria-label': props.accessibilityLabel as string,
          role: props.accessibilityRole as string,
          onClick: props.onPress as () => void,
        },
        children,
      ),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: () => vi.fn() }),
}))
vi.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ recipeId: 'recipe-1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))
vi.mock('../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
vi.mock('../../convex/api', () => ({
  api: {
    recipes: {
      get: 'recipes:get',
      list: 'recipes:list',
      remove: 'recipes:remove',
      aiConfigured: 'recipes:aiConfigured',
      setNutrition: 'recipes:setNutrition',
      rate: 'recipes:rate',
    },
    recipeNutrition: { estimateNutrition: 'recipeNutrition:estimateNutrition' },
  },
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (fn: string) =>
    fn === 'recipes:get'
      ? {
          _id: 'recipe-1',
          title: 'Pasta',
          tags: [],
          ingredients: ['Pasta'],
          steps: ['Boil'],
          canEdit: true,
          sourceUrl: SOURCE_URL,
        }
      : false,
}))
vi.mock('../../feedback/confirmDestructive', () => ({
  confirmDestructive: vi.fn(),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: { actionFailed: vi.fn(), selectionChanged: vi.fn() },
}))
vi.mock('../../i18n', async () => {
  const { fmt, plural } = await import('@gather/core/i18n')
  const { en } = await import('../../i18n/messages/en')
  const { nl } = await import('../../i18n/messages/nl')
  return {
    fmt,
    plural,
    useI18n: () => ({ t: { en, nl }[state.locale], locale: state.locale }),
  }
})
vi.mock('../../observability/native-presentation', () => ({
  openBrowserAsync: state.openBrowser,
  showAlert: state.alert,
}))
vi.mock('../../search/recentRecordsStore', () => ({
  useRecordRecent: () => {},
}))
vi.mock('../../theme/icons', () => {
  const icons = new Proxy({}, { get: () => () => null })
  return { MODULE_ICONS: icons, UI_ICONS: icons }
})
vi.mock('../../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return {
    RADIUS: any,
    SPACE: any,
    TABULAR: {},
    TYPE: any,
    useTokens: () => ({ tintOf: () => ({}) }),
  }
})
vi.mock('../../ui/button', () => ({ Button: () => null }))
vi.mock('../../ui/facts-strip', () => ({ FactsStrip: () => null }))
vi.mock('../../ui/inset-list', () => ({
  InsetList: ({ children }: Props) => children ?? null,
  InsetRow: () => null,
}))
vi.mock('../../ui/photo-header', () => ({
  PhotoHeader: () => null,
  usePhotoTitle: () => ({
    shown: false,
    laidOut: false,
    onScroll: () => {},
    onTitleBottom: () => {},
  }),
}))
vi.mock('../../ui/screen-header', () => ({
  pendingScreenOptions: () => ({}),
  photoScreenOptions: () => ({}),
  washScreenOptions: () => ({}),
}))
vi.mock('../../ui/section-label', () => ({ SectionLabel: () => null }))
vi.mock('../../ui/wash-header', () => ({ WashHeader: () => null }))
vi.mock('../kitchen/add-to-groceries/recipe-sheet', () => ({
  RecipeToGroceriesSheet: () => null,
}))
vi.mock('../moduleDestination', () => ({ moduleHref: () => '/all/recipes' }))
vi.mock('./icons', () => ({
  RECIPE_UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('./NutritionFacts', () => ({ NutritionFacts: () => null }))
vi.mock('./StarRating', () => ({ StarRating: () => null }))
vi.mock('./useRecipes', () => ({ useRecipes: () => ({ groupSlug: 'home' }) }))

let view: ReturnType<typeof mount> | undefined
afterEach(() => view?.unmount())
beforeEach(() => {
  state.openBrowser.mockReset().mockResolvedValue({ type: 'opened' })
  state.alert.mockReset()
})

function sourceLink() {
  view = mount(<RecipeScreen />)
  const link = view.container.querySelector<HTMLElement>(
    '[data-testid="recipe-source"]',
  )
  if (!link) throw new Error('no recipe source link')
  return link
}

describe.each([
  ['en', 'This page could not be opened. Try again.'],
  ['nl', 'Deze pagina kon niet worden geopend. Probeer het opnieuw.'],
] as const)('Recipe source link (%s)', (locale, failedMessage) => {
  beforeEach(() => {
    state.locale = locale
  })

  test('alerts when the browser cannot open and opens on retry', async () => {
    state.openBrowser.mockRejectedValueOnce(new Error('No browser'))
    const link = sourceLink()

    act(() => link.click())
    await settle()
    expect(state.openBrowser).toHaveBeenCalledWith(SOURCE_URL)
    expect(state.alert.mock.calls).toEqual([[failedMessage]])

    act(() => link.click())
    await settle()
    expect(state.openBrowser).toHaveBeenCalledTimes(2)
    expect(state.alert).toHaveBeenCalledTimes(1)
  })
})
