/**
 * The aisles a grocery item can be in, in the default walking order of a
 * typical Dutch supermarket (`designs/groceries/README.md`, "Aisles"). The ids
 * are stored on items, in the shared AI cache and in Group overrides, so they
 * never change; a new aisle is appended before `other`.
 */
export const GROCERY_AISLES = [
  'produce',
  'bakery',
  'dairy',
  'cheese_deli',
  'meat_fish',
  'pasta_world',
  'tins_sauces',
  'breakfast',
  'snacks',
  'frozen',
  'drinks',
  'care_baby',
  'household',
  'other',
] as const

export type GroceryAisle = (typeof GROCERY_AISLES)[number]

export function isGroceryAisle(value: unknown): value is GroceryAisle {
  return (
    typeof value === 'string' &&
    (GROCERY_AISLES as readonly string[]).includes(value)
  )
}

/**
 * A grocery list's aisle order (APP-313): the order its store saved, read
 * defensively. Ids this build does not know and repeats are dropped, and an
 * aisle the saved order does not name (one added after it was saved) comes
 * last, in the default order. No saved order is the default walking order.
 */
export function aisleOrder(
  saved: readonly string[] | null | undefined,
): GroceryAisle[] {
  const order: GroceryAisle[] = []
  for (const id of saved ?? []) {
    if (isGroceryAisle(id) && !order.includes(id)) order.push(id)
  }
  for (const aisle of GROCERY_AISLES) {
    if (!order.includes(aisle)) order.push(aisle)
  }
  return order
}

/** Whether an order is the default walking order, whatever it was saved as. */
export function isDefaultAisleOrder(
  saved: readonly string[] | null | undefined,
): boolean {
  return aisleOrder(saved).every((aisle, index) => aisle === GROCERY_AISLES[index])
}

/**
 * What belongs where, in English, for the cases shops split differently. The
 * eval set's header (`eval/groceryLines.txt`) labels by the same rules and the
 * AI fallback is given this text, so a person, the dictionary and the model
 * put an item in the same aisle.
 */
export const GROCERY_AISLE_GUIDE: Record<GroceryAisle, string> = {
  produce: 'fresh fruit, vegetables, potatoes, fresh herbs, salad, mushrooms',
  bakery: 'bread, rolls, croissants, fresh cakes and pastries',
  dairy:
    'milk, yoghurt, quark, chilled desserts, cream, butter, margarine, eggs, plant-based drinks',
  cheese_deli:
    'cheese, sliced meats, salami, hummus and chilled sandwich spreads',
  meat_fish:
    'fresh meat, poultry, fish, seafood, smoked sausage, bacon, meat substitutes, tofu',
  pasta_world:
    'pasta, rice, noodles, wraps, pasta sauce, pesto, Asian and Mexican ingredients and sauces',
  tins_sauces:
    'tins and jars, soup, stock, oil, vinegar, salt, spices, ketchup, mayonnaise, mustard, flour, sugar, baking ingredients',
  breakfast:
    'breakfast cereal, oats, sweet spreads, peanut butter, jam, honey, crackers, rusks, coffee, tea',
  snacks: 'biscuits, sweets, chocolate, crisps, nuts, dried fruit',
  frozen: 'anything sold frozen, ice cream',
  drinks: 'water, soft drinks, juice, beer, wine, spirits, squash',
  care_baby:
    'toiletries, cosmetics, medicine, vitamins, nappies, baby food, baby milk',
  household:
    'cleaning products, laundry, toilet paper, kitchen roll, bags, foil, batteries, candles, pet food',
  other: 'not something a supermarket sells',
}
