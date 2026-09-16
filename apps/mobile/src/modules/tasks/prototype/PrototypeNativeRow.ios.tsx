import {
  Button,
  ContextMenu,
  RNHostView,
  SwipeActions,
} from '@expo/ui/swift-ui'
import {
  disabled as disable,
  listRowInsets,
  tint,
} from '@expo/ui/swift-ui/modifiers'
import { View } from 'react-native'
import { useI18n } from '../../../i18n'
import { useTokens } from '../../../theme/tokens'
import type { NativeRowProps } from './PrototypeNativeRow'

export function PrototypeNativeRow({
  children,
  disabled,
  done,
  actions,
  onMenu,
  onToggle,
  onOpen,
  onDelete,
}: NativeRowProps) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const m = t.tasksPrototype
  return (
    <SwipeActions
      modifiers={[
        listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
      ]}
    >
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents>
            <View style={{ paddingHorizontal: 16 }}>{children}</View>
          </RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {actions.map((action) => (
            <Button
              key={action.id}
              label={action.title}
              role={action.attributes?.destructive ? 'destructive' : 'default'}
              modifiers={[disable(!!action.attributes?.disabled)]}
              onPress={() => onMenu(action.id!)}
            />
          ))}
        </ContextMenu.Items>
      </ContextMenu>
      {!disabled ? (
        <SwipeActions.Actions edge="leading" allowsFullSwipe>
          <Button
            label={done ? m.undo : m.complete}
            systemImage="checkmark"
            modifiers={[tint('#3f7d4e')]}
            onPress={onToggle}
          />
        </SwipeActions.Actions>
      ) : null}
      {!disabled ? (
        <SwipeActions.Actions edge="trailing" allowsFullSwipe>
          <Button
            label={m.edit}
            systemImage="pencil"
            modifiers={[tint(tokens.accent)]}
            onPress={onOpen}
          />
          {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI Button role is native, not ARIA. */}
          <Button
            label={m.delete}
            systemImage="trash"
            role="destructive"
            onPress={onDelete}
          />
        </SwipeActions.Actions>
      ) : null}
    </SwipeActions>
  )
}
