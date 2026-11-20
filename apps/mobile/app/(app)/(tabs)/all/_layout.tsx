import { GroupScopedStack } from '../../../../src/group/GroupScopedStack'

/**
 * A screen opened straight into All (the control, a push tap, a link) sits on
 * the All index, so it has a back button (APP-454).
 */
export const unstable_settings = { anchor: 'index' }

/** All's stack, where every Module's screens live (ADR-0023). */
export default GroupScopedStack
