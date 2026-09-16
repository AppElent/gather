/**
 * The axes a Labs screen can be flipped along, and how they survive a reload.
 *
 * ## Why axes and not variants
 *
 * The usual prototype shape is three finished screens you pick between. That is
 * the wrong shape here, because the interesting answer is almost never "B" — it
 * is *the header from B with the composer from C*, and a set of whole screens
 * cannot say that. So each open question is its own axis with its own options,
 * and the screen is whatever combination you are looking at. Three axes with
 * three, two and three options is eighteen screens nobody had to draw.
 *
 * ## Why the URL
 *
 * The choice lives in the route's search params, so a combination is a link. A
 * Labs row can point at one, a person can go back to one, and rotating the
 * phone does not lose it. Nothing is persisted: this is a prototype, and a
 * remembered variant is a remembered decision nobody made.
 */

export interface VariantOption<Value extends string> {
  value: Value
  /** Resolved by the caller from the message tree — never a literal. */
  label: string
  /** True on the option the design canvas already argued for. */
  chosen?: boolean
}

export interface VariantAxis<Value extends string> {
  /** The search-param key. Short, because it ends up in a link. */
  id: string
  label: string
  options: readonly VariantOption<Value>[]
}

/**
 * The value a param currently names, or the axis's own default — which is
 * always the option the canvas chose, so opening a Labs screen with no params
 * shows the decided design and nothing else.
 */
export function readAxis<Value extends string>(
  axis: VariantAxis<Value>,
  param: string | string[] | undefined,
): Value {
  const raw = Array.isArray(param) ? param[0] : param
  const match = axis.options.find((option) => option.value === raw)
  if (match) return match.value
  const chosen = axis.options.find((option) => option.chosen)
  return (chosen ?? axis.options[0]).value
}

/** `?nav=fluid&cell=bars` — the readable half of a Labs row. */
export function describeCombination(
  entries: readonly (readonly [string, string])[],
): string {
  return entries.map(([key, value]) => `${key}=${value}`).join(' · ')
}
