const RESERVED_MODULE_PATH_SEGMENTS = new Set([
  'home',
  'modules',
  'members',
  'settings',
])

export function assertValidModulePathSegment(pathSegment: string) {
  if (RESERVED_MODULE_PATH_SEGMENTS.has(pathSegment)) {
    throw new Error(`${pathSegment} is reserved`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathSegment)) {
    throw new Error(`${pathSegment} is not a valid module path segment`)
  }
}

function encodeSegment(segment: string) {
  return encodeURIComponent(segment)
}

export const spacePath = {
  home(spaceSlug: string) {
    return `/s/${encodeSegment(spaceSlug)}/home`
  },
  modules(spaceSlug: string) {
    return `/s/${encodeSegment(spaceSlug)}/modules`
  },
  members(spaceSlug: string) {
    return `/s/${encodeSegment(spaceSlug)}/members`
  },
  settings(spaceSlug: string) {
    return `/s/${encodeSegment(spaceSlug)}/settings`
  },
  module(spaceSlug: string, modulePathSegment: string) {
    assertValidModulePathSegment(modulePathSegment)
    return `/s/${encodeSegment(spaceSlug)}/${modulePathSegment}`
  },
}
