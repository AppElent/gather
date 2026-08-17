/**
 * The design-system bundle's single entry point.
 *
 * Everything a design agent may compose with is reachable from
 * `window.GatherMobile`. Components come from `apps/mobile/src` unchanged —
 * this file adds no styling and reimplements nothing, it only re-exports and
 * supplies the provider wrap those components require to render at all.
 */
import { MODULE_TINTS } from '@gather/core/module-tints'
import { MODULE_GROUPS, MODULES, moduleById, moduleText } from '@gather/core/modules'
import Storage from 'expo-sqlite/kv-store'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvailabilityProvider } from '../src/availability/AvailabilityProvider'
import { AuthButton } from '../src/components/AuthButton'
import { AuthError } from '../src/components/AuthError'
import { AuthField } from '../src/components/AuthField'
import { AuthLink } from '../src/components/AuthLink'
import { AuthScreen } from '../src/components/AuthScreen'
import { AuthUnavailable } from '../src/components/AuthUnavailable'
import { CatalogueGrid, CatalogueStrip } from '../src/components/Catalogue'
import { ConnectionLostBanner } from '../src/components/ConnectionLostBanner'
import { GroupForms } from '../src/components/GroupForms'
import { GroupPending } from '../src/components/GroupPending'
import { ModulePlaceholder } from '../src/components/ModulePlaceholder'
import { NoGroup } from '../src/components/NoGroup'
import { Segmented } from '../src/components/Segmented'
import { SettingsCard, SettingsRow } from '../src/components/SettingsCard'
import { SocialSoon } from '../src/components/SocialSoon'
import { WelcomeActions } from '../src/components/WelcomeActions'
import { LocaleProvider, useI18n } from '../src/i18n'
import { ModuleTab } from '../src/shell/ModuleTab'
import { QuickActionSheet } from '../src/shell/QuickActionSheet'
import { AppearanceProvider, useAppearance } from '../src/theme/appearance'
import { MODULE_ICONS, UI_ICONS } from '../src/theme/icons'
import { RADIUS, useTokens } from '../src/theme/tokens'

/**
 * A phone's worth of insets. `SafeAreaProvider` measures a real device; in a
 * browser there is nothing to measure, so components that read
 * `useSafeAreaInsets()` collapse their padding to zero unless they are handed
 * metrics. These are an iPhone 14's.
 */
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
}

/**
 * The wrap every gather mobile component needs.
 *
 * Order matters: `useTokens` reads `AppearanceProvider`, and it *throws* outside
 * it rather than assuming light — a screen in the wrong scheme is a wiring bug,
 * and that is deliberate (see `src/theme/appearance.tsx`).
 */
export function PreviewRoot({ children }) {
  return (
    <SafeAreaProvider initialMetrics={PHONE_METRICS}>
      <AppearanceProvider>
        <LocaleProvider>
          <AvailabilityProvider>{children}</AvailabilityProvider>
        </LocaleProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  )
}

/**
 * Mount a specimen in a given scheme.
 *
 * The scheme is seeded into the preference store rather than passed as a prop,
 * because that is the only door `AppearanceProvider` has: it reads the stored
 * choice once, synchronously, in a `useState` initialiser. Seeding before the
 * first render is what makes a dark preview genuinely dark rather than a light
 * tree repainted a frame later.
 */
export function mount(container, element, options = {}) {
  const { scheme = 'light' } = options
  Storage.setItemSync('gather:appearance', scheme)
  createRoot(container).render(
    <React.StrictMode>
      <PreviewRoot>{element}</PreviewRoot>
    </React.StrictMode>,
  )
}

export {
  // Auth
  AuthButton,
  AuthError,
  AuthField,
  AuthLink,
  AuthScreen,
  AuthUnavailable,
  // Shell
  CatalogueGrid,
  CatalogueStrip,
  ConnectionLostBanner,
  GroupForms,
  GroupPending,
  ModulePlaceholder,
  ModuleTab,
  NoGroup,
  QuickActionSheet,
  SocialSoon,
  WelcomeActions,
  // Settings
  Segmented,
  SettingsCard,
  SettingsRow,
  // Foundations
  MODULE_ICONS,
  MODULE_GROUPS,
  MODULE_TINTS,
  MODULES,
  RADIUS,
  UI_ICONS,
  moduleById,
  moduleText,
  useAppearance,
  useI18n,
  useTokens,
  // React Native primitives, for the layout glue between library components.
  // Without these a caller has no idiomatic way to build a row or a screen —
  // and reaching for raw DOM elements would mix two layout models in one tree.
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaProvider,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useSafeAreaInsets,
  // Escape hatch for preview code
  React,
}

export const h = React.createElement
