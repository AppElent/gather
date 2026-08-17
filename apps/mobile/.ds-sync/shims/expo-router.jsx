// Browser shim: expo-router's navigation surface is meaningless in a static
// preview. Screen options are swallowed; Link renders as inert content.
import { Text } from 'react-native'

function Screen() {
  return null
}

export const Stack = { Screen }
export const Tabs = { Screen }

export function Link({ children, ...props }) {
  if (typeof children === 'string') return <Text {...props}>{children}</Text>
  return children ?? null
}

export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    navigate: () => {},
    dismiss: () => {},
    setParams: () => {},
  }
}

export const router = useRouter()
export function useLocalSearchParams() {
  return {}
}
export function useSegments() {
  return []
}
export function usePathname() {
  return '/'
}
export function useFocusEffect() {}
export function Redirect() {
  return null
}
export function useNavigation() {
  return { setOptions: () => {} }
}
