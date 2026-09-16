import type { MenuAction } from '@expo/ui/community/menu'
import type { ReactElement } from 'react'
export interface NativeRowProps {
  children: ReactElement
  disabled: boolean
  done: boolean
  actions: MenuAction[]
  onMenu: (id: string) => void
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
}
export function PrototypeNativeRow({ children }: NativeRowProps) {
  return children
}
