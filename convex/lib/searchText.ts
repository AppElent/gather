/** How the Group search compares text: trimmed and lowercased. */
export function normalized(value: string) {
  return value.trim().toLocaleLowerCase()
}
