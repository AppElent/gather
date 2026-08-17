// Browser shim: there is no native splash to hand the screen back from.
// `useHideSplash` returns an onLayout handler that calls this; a no-op keeps
// every first-screen component (NoGroup, GroupPending, AuthUnavailable) mountable.
export async function hideAsync() {}
export async function preventAutoHideAsync() {}
export function setOptions() {}
