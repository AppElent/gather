import { Redirect } from 'expo-router'

/** PROTOTYPE (#146) — open on shape A. The bar on the right edge switches. */
export default function Index() {
  return <Redirect href={'/a/home' as never} />
}
