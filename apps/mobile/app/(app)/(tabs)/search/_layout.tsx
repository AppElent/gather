import { GroupScopedStack } from '../../../../src/group/GroupScopedStack'

/**
 * A result opened straight into Search (a link at cold start) sits on the
 * Search screen, so it has a back button (APP-454).
 */
export const unstable_settings = { anchor: 'index' }

/**
 * Search's stack. It is not decoration: `Stack.SearchBar` on the screen below
 * is the native search bar, and it needs a native header to live in.
 */
export default GroupScopedStack
