// SwiftUI List is required for the system's swipe actions and full-swipe gesture.
import { Host, List, RNHostView, Section, Text } from '@expo/ui/swift-ui'
import {
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listStyle,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTokens } from '../../../theme/tokens'
import type { PrototypeFeedProps } from './PrototypeFeed'

export function PrototypeFeed({
  header,
  footer,
  sections,
  renderRow,
  empty,
}: PrototypeFeedProps) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const mods = [
    listRowBackground(tokens.bg),
    listRowSeparator('hidden'),
    listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
  ]
  return (
    <Host
      style={{ flex: 1, backgroundColor: tokens.bg }}
      colorScheme={tokens.scheme}
      seedColor={tokens.accent}
    >
      <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
        <Section modifiers={mods}>
          <RNHostView matchContents>
            <View style={{ paddingHorizontal: 16 }}>{header}</View>
          </RNHostView>
        </Section>
        {sections.map((section) => (
          <Section key={section.title} title={section.title} modifiers={mods}>
            {section.tasks.length ? (
              section.tasks.map(renderRow)
            ) : (
              <Text>{empty}</Text>
            )}
          </Section>
        ))}
        <Section modifiers={mods}>
          <RNHostView matchContents>
            <View
              style={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 100,
              }}
            >
              {footer}
            </View>
          </RNHostView>
        </Section>
      </List>
    </Host>
  )
}
