/**
 * `react-native` for the browser: react-native-web, plus the one API gather
 * uses that it does not implement.
 *
 * `AppearanceProvider` calls `Appearance.setColorScheme` to move the *platform's*
 * idea of the scheme (the keyboard, the selection handles, the tab bar — things
 * gather does not draw). react-native-web has no such platform surface and ships
 * no such method, so the call throws inside a passive effect and React unmounts
 * the whole tree. A no-op is the honest web answer: there is nothing underneath
 * the page to tell.
 */
import * as ReactNativeWeb from 'react-native-web'

if (
  ReactNativeWeb.Appearance &&
  typeof ReactNativeWeb.Appearance.setColorScheme !== 'function'
) {
  ReactNativeWeb.Appearance.setColorScheme = () => {}
}

export * from 'react-native-web'
