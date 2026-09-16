import type { ReactNode } from 'react'
import { ScrollView, Text } from 'react-native'
import { useTokens } from '../../../theme/tokens'
import type { SampleTask } from './state'

export interface PrototypeFeedProps {
  header: ReactNode
  footer: ReactNode
  sections: { title: string; tasks: SampleTask[] }[]
  renderRow: (task: SampleTask) => ReactNode
  empty: string
}
export function PrototypeFeed({
  header,
  footer,
  sections,
  renderRow,
  empty,
}: PrototypeFeedProps) {
  const tokens = useTokens('home')
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
    >
      {header}
      {sections.map((section) => (
        <ScrollSection
          key={section.title}
          section={section}
          renderRow={renderRow}
          empty={empty}
        />
      ))}
      {footer}
    </ScrollView>
  )
}
function ScrollSection({
  section,
  renderRow,
  empty,
}: {
  section: PrototypeFeedProps['sections'][number]
  renderRow: PrototypeFeedProps['renderRow']
  empty: string
}) {
  const tokens = useTokens('home')
  return (
    <>
      {section.title ? (
        <Text
          style={{
            color: tokens.fg,
            fontSize: 17,
            fontWeight: '600',
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          {section.title}
        </Text>
      ) : null}
      {section.tasks.length ? (
        section.tasks.map(renderRow)
      ) : (
        <Text style={{ color: tokens.muted, paddingVertical: 16 }}>
          {empty}
        </Text>
      )}
    </>
  )
}
