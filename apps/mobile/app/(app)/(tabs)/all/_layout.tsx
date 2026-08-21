/**
 * All's own stack, for Home's reason: this is the other tab a Module opens
 * inside (#163), so it is the other one that can be left sitting on the
 * previous Group's content when the Group changes. Its Group-keyed stack
 * resets it to the root without touching the fixed tab navigator.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'
import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function AllStackLayout() {
  const { group } = useGroup()

  return (
    // Inside the tab, so every screen below reads the tab's own edges —
    // including the height of the translucent native tab bar drawn over them.
    <TabSafeArea>
      <Stack
        key={group.slug}
        screenOptions={{
          headerShown: false,
          // iOS only, and ignored everywhere else: the title starts big and
          // collapses into the bar as the screen scrolls. It is the single
          // most recognisably-iOS piece of chrome there is, and it costs one
          // option plus `contentInsetAdjustmentBehavior="automatic"` on each
          // screen's scroll view — which is what tells UIKit *which* scroll
          // view the title is supposed to collapse against.
          headerLargeTitle: true,
        }}
      >
        {/* Declared first, and that is the whole reason it is declared: a
          `Stack.Screen` child reorders its route to the front of the stack,
          and the front of a stack is the route it opens on. Listing the sheet
          below without naming the root first opened this tab *on the entry
          sheet*. */}
        <Stack.Screen name="index" />
        <Stack.Screen
          name="baby-log/entry"
          options={{
            // The platform's own sheet, rather than a `Modal` with a
            // hand-written drag inside it: `formSheet` is
            // `UISheetPresentationController` on iOS and the equivalent on
            // Android, so the rubber-band drag, the detents, the grabber, the
            // scrim and the keyboard are all native behaviour we do not write.
            presentation: 'card',
            sheetGrabberVisible: true,
            // `fitToContents` rather than a fixed fraction, and that is the
            // fix for "dragging under the top scrolls the form instead of
            // closing it". A sheet only dismisses by drag when the scroll
            // view inside it is already at the top — that part is UIKit's
            // rule, not ours — so a detent shorter than the form turns most
            // of the sheet into a scroller. Sized to its content, a short
            // form has nothing to scroll and every drag dismisses; a long
            // one (the edit view) grows to fill the screen, where scrolling
            // is what you meant anyway.
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 20,
            // No bar. A sheet's actions in a navigation bar is the iOS
            // pattern and it was tried here — but `react-native-screens`
            // draws no header on Android's `formSheet`, which left the whole
            // of Edit unreachable on one of the two platforms. The actions
            // are in the sheet, where both platforms can see them.
            headerShown: false,
          }}
        />
      </Stack>
    </TabSafeArea>
  )
}
