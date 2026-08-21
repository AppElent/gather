export function nativeSheetLayout(platform: string) {
  return platform === 'ios'
    ? { fill: true, paddingTop: 8 }
    : { fill: false, paddingTop: 0 }
}
