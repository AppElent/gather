import type { SmartListId } from '@gather/core/smart-lists'

/** A smart list's icon, as the lucide name the web draws it with. */
export const SMART_GLYPHS: Record<SmartListId, string> = {
  today: 'Sun',
  mine: 'User',
  upcoming: 'Calendar',
  unassigned: 'UserPlus',
}
