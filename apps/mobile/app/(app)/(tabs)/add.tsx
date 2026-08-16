import { Redirect } from 'expo-router'

/** A disabled native tab requires a route, but Add is never a destination. */
export default function AddTab() {
  return <Redirect href="/home" />
}
