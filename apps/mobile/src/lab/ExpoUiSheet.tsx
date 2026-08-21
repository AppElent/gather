/**
 * The `@expo/ui` variant: a SwiftUI sheet with no address, opened over whatever
 * is already on screen. Deleted with the rest of `src/lab/`.
 *
 * Isolated in its own file so that the one new native dependency has exactly
 * one import site — if this mechanism loses, deleting the lab deletes the only
 * reason `@expo/ui` was added for sheets.
 *
 * `BottomSheetModal` rather than `BottomSheet`: the modal variant starts closed
 * and is opened imperatively, which is what a launcher is.
 */
import {
  type BottomSheetMethods,
  BottomSheetModal,
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet'
import { useEffect, useRef } from 'react'

import { SheetBody } from './SheetBody'
import type { ContentKind } from './sheetContent'
import { VARIANTS } from './sheetVariants'

export function ExpoUiSheet({
  open,
  kind,
  onClose,
}: {
  open: boolean
  kind: ContentKind
  onClose: () => void
}) {
  const ref = useRef<BottomSheetMethods>(null)
  const info = VARIANTS['expo-ui']

  useEffect(() => {
    if (open) ref.current?.present()
    else ref.current?.dismiss()
  }, [open])

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={['50%', '90%']}
      enablePanDownToClose
      onClose={onClose}
    >
      <BottomSheetView>
        <SheetBody
          kind={kind}
          title={info.label}
          watch={info.watch}
          fill={false}
        />
      </BottomSheetView>
    </BottomSheetModal>
  )
}
