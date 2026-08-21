/** Sheet lab variant. Deleted with `src/lab/`; see that directory's header. */
import { useLocalSearchParams } from 'expo-router'

import { SheetBody } from '../../../src/lab/SheetBody'
import type { ContentKind } from '../../../src/lab/sheetContent'
import { VARIANTS } from '../../../src/lab/sheetVariants'

export default function SheetFit() {
  const { kind } = useLocalSearchParams<{ kind?: ContentKind }>()
  const info = VARIANTS.fit

  return (
    <SheetBody
      kind={kind ?? 'rows'}
      title={info.label}
      watch={info.watch}
      fill={false}
    />
  )
}
