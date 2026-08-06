import type { NutritionFacts } from '../nutrition'
import type { Serving } from '../servings'

/**
 * The Catalog: reference foods present in every environment, production
 * included. Owned by nobody and read-only in the app — a person who needs a
 * variant creates their own food instead (ADR 0004).
 *
 * `seedKey` is the stable identity across re-seeds; it never changes once
 * shipped, even if `name` does. Renaming a key orphans the old row.
 *
 * All figures are per 100 g/ml, calories in kcal and everything else in
 * grams, matching `nutritionPer100`. They are representative generic values
 * for cooking, not a branded product's label — a specific product belongs in
 * the app via a barcode scan, not here.
 */
export interface CatalogFood {
  seedKey: string
  name: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  /**
   * What somebody calls a portion of this, in the food's base unit — the
   * shortest route from "two slices of bread" to a number of grams (#68).
   *
   * Hand-authored, and reviewed as fixture data even where a draft came out of
   * the AI estimator: estimating never runs while somebody is logging, because
   * logging has to feel instant. Labels are content, so they are not
   * translated (ADR-0011).
   */
  servings?: Serving[]
  /** The single serving these used to be. Both fields go in #71. */
  servingSize?: number
  servingLabel?: string
}

export const CATALOG_FOODS: CatalogFood[] = [
  // Store cupboard
  {
    seedKey: 'flour-plain',
    name: 'Flour, plain',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 364,
      protein: 10,
      carbs: 76,
      sugars: 0.3,
      fat: 1,
      saturatedFat: 0.2,
      fiber: 2.7,
      salt: 0,
    },
    servings: [
      { label: '1 tbsp', amount: 8 },
      { label: '1 cup', amount: 120 },
    ],
  },
  {
    seedKey: 'sugar-granulated',
    name: 'Sugar, granulated',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 400,
      protein: 0,
      carbs: 100,
      sugars: 100,
      fat: 0,
      saturatedFat: 0,
      fiber: 0,
      salt: 0,
    },
    servings: [
      { label: '1 tsp', amount: 4 },
      { label: '1 tbsp', amount: 12 },
    ],
  },
  {
    seedKey: 'rice-white-dry',
    name: 'Rice, white long grain (dry)',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 360,
      protein: 7,
      carbs: 79,
      sugars: 0.1,
      fat: 0.7,
      saturatedFat: 0.2,
      fiber: 1.3,
      salt: 0.01,
    },
    servings: [
      { label: '1 portion', amount: 75 },
      { label: '1 cup', amount: 185 },
    ],
  },
  {
    seedKey: 'pasta-dry',
    name: 'Pasta, dried',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 371,
      protein: 13,
      carbs: 74.7,
      sugars: 3.2,
      fat: 1.5,
      saturatedFat: 0.3,
      fiber: 3.2,
      salt: 0.02,
    },
    servings: [
      { label: '1 portion', amount: 100 },
    ],
  },
  {
    seedKey: 'lentils-dry',
    name: 'Lentils, dried',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 353,
      protein: 25,
      carbs: 60,
      sugars: 2,
      fat: 1.1,
      saturatedFat: 0.2,
      fiber: 30.5,
      salt: 0.01,
    },
    servings: [
      { label: '1 portion', amount: 80 },
    ],
  },
  {
    seedKey: 'chickpeas-tinned',
    name: 'Chickpeas, tinned (drained)',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 139,
      protein: 7.1,
      carbs: 16.6,
      sugars: 0.6,
      fat: 2.6,
      saturatedFat: 0.3,
      fiber: 6.4,
      salt: 0.6,
    },
    servings: [
      { label: '1 tin', amount: 240 },
      { label: 'half a tin', amount: 120 },
    ],
  },
  {
    seedKey: 'chopped-tomatoes-tinned',
    name: 'Chopped tomatoes, tinned',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 32,
      protein: 1.3,
      carbs: 5.4,
      sugars: 4.5,
      fat: 0.3,
      saturatedFat: 0.1,
      fiber: 1.3,
      salt: 0.03,
    },
    servings: [
      { label: '1 tin', amount: 400 },
      { label: 'half a tin', amount: 200 },
    ],
  },
  {
    seedKey: 'olive-oil',
    name: 'Olive oil',
    baseUnit: 'ml',
    nutritionPer100: {
      calories: 884,
      protein: 0,
      carbs: 0,
      sugars: 0,
      fat: 100,
      saturatedFat: 13.8,
      fiber: 0,
      salt: 0,
    },
    servings: [
      { label: '1 tbsp', amount: 15 },
      { label: '1 tsp', amount: 5 },
    ],
    servingSize: 15,
    servingLabel: '1 tbsp (15 ml)',
  },
  {
    seedKey: 'peanut-butter',
    name: 'Peanut butter',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 588,
      protein: 25,
      carbs: 20,
      sugars: 9,
      fat: 50,
      saturatedFat: 10,
      fiber: 6,
      salt: 1,
    },
    servings: [
      { label: '1 knife', amount: 10 },
      { label: '1 tbsp', amount: 16 },
    ],
  },

  // Dairy and eggs
  {
    seedKey: 'egg-whole',
    name: 'Egg, whole',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 143,
      protein: 12.6,
      carbs: 0.7,
      sugars: 0.4,
      fat: 9.5,
      saturatedFat: 3.1,
      fiber: 0,
      salt: 0.36,
    },
    servings: [
      { label: '1 medium egg', amount: 50 },
      { label: '1 large egg', amount: 60 },
    ],
    servingSize: 50,
    servingLabel: '1 medium egg (50 g)',
  },
  {
    seedKey: 'milk-whole',
    name: 'Milk, whole',
    baseUnit: 'ml',
    nutritionPer100: {
      calories: 61,
      protein: 3.2,
      carbs: 4.8,
      sugars: 4.8,
      fat: 3.3,
      saturatedFat: 1.9,
      fiber: 0,
      salt: 0.1,
    },
    servings: [
      { label: '1 glass', amount: 250 },
      { label: '1 mug', amount: 200 },
      { label: 'a splash in tea', amount: 30 },
    ],
    servingSize: 250,
    servingLabel: '1 glass (250 ml)',
  },
  {
    seedKey: 'milk-semi-skimmed',
    name: 'Milk, semi-skimmed',
    baseUnit: 'ml',
    nutritionPer100: {
      calories: 47,
      protein: 3.4,
      carbs: 4.8,
      sugars: 4.8,
      fat: 1.7,
      saturatedFat: 1.1,
      fiber: 0,
      salt: 0.1,
    },
    servings: [
      { label: '1 glass', amount: 250 },
      { label: '1 mug', amount: 200 },
      { label: 'a splash in tea', amount: 30 },
    ],
    servingSize: 250,
    servingLabel: '1 glass (250 ml)',
  },
  {
    seedKey: 'butter-unsalted',
    name: 'Butter, unsalted',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 717,
      protein: 0.9,
      carbs: 0.1,
      sugars: 0.1,
      fat: 81,
      saturatedFat: 51,
      fiber: 0,
      salt: 0.02,
    },
    servings: [
      { label: '1 knife', amount: 7 },
      { label: '1 tbsp', amount: 14 },
    ],
  },
  {
    seedKey: 'yoghurt-greek-natural',
    name: 'Greek yoghurt, natural',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 97,
      protein: 9,
      carbs: 3.9,
      sugars: 3.9,
      fat: 5,
      saturatedFat: 3.4,
      fiber: 0,
      salt: 0.1,
    },
    servings: [
      { label: '1 pot', amount: 150 },
      { label: '1 large spoon', amount: 30 },
    ],
    servingSize: 150,
    servingLabel: '1 pot (150 g)',
  },
  {
    seedKey: 'cheese-cheddar',
    name: 'Cheddar',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 416,
      protein: 25.4,
      carbs: 0.1,
      sugars: 0.1,
      fat: 34.9,
      saturatedFat: 21.7,
      fiber: 0,
      salt: 1.8,
    },
    servings: [
      { label: '1 slice', amount: 25 },
      { label: '1 handful grated', amount: 30 },
    ],
  },
  {
    seedKey: 'cheese-parmesan',
    name: 'Parmesan',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 431,
      protein: 38.5,
      carbs: 4.1,
      sugars: 0.9,
      fat: 29,
      saturatedFat: 19.1,
      fiber: 0,
      salt: 3.9,
    },
    servings: [
      { label: '1 tbsp grated', amount: 5 },
      { label: '1 handful grated', amount: 25 },
    ],
  },
  {
    seedKey: 'feta',
    name: 'Feta',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 264,
      protein: 14.2,
      carbs: 4.1,
      sugars: 4.1,
      fat: 21.3,
      saturatedFat: 14.9,
      fiber: 0,
      salt: 3,
    },
    servings: [
      { label: 'crumbled over a salad', amount: 30 },
      { label: 'half a pack', amount: 100 },
    ],
  },

  // Meat and fish
  {
    seedKey: 'chicken-breast-raw',
    name: 'Chicken breast, raw',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 120,
      protein: 22.5,
      carbs: 0,
      sugars: 0,
      fat: 2.6,
      saturatedFat: 0.7,
      fiber: 0,
      salt: 0.15,
    },
    servings: [
      { label: '1 breast', amount: 150 },
    ],
  },
  {
    seedKey: 'beef-mince-5',
    name: 'Beef mince, 5% fat',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 137,
      protein: 21.5,
      carbs: 0,
      sugars: 0,
      fat: 5,
      saturatedFat: 2.2,
      fiber: 0,
      salt: 0.15,
    },
    servings: [
      { label: '1 portion', amount: 125 },
      { label: '1 pack', amount: 500 },
    ],
  },
  {
    seedKey: 'salmon-fillet-raw',
    name: 'Salmon fillet, raw',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 208,
      protein: 20.4,
      carbs: 0,
      sugars: 0,
      fat: 13.4,
      saturatedFat: 3.1,
      fiber: 0,
      salt: 0.12,
    },
    servings: [
      { label: '1 fillet', amount: 130 },
    ],
  },

  // Fruit and vegetables
  {
    seedKey: 'potato',
    name: 'Potato',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 77,
      protein: 2,
      carbs: 17,
      sugars: 0.8,
      fat: 0.1,
      saturatedFat: 0,
      fiber: 2.2,
      salt: 0.01,
    },
    servings: [
      { label: '1 medium potato', amount: 175 },
      { label: '1 small potato', amount: 120 },
    ],
  },
  {
    seedKey: 'onion',
    name: 'Onion',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 40,
      protein: 1.1,
      carbs: 9.3,
      sugars: 4.2,
      fat: 0.1,
      saturatedFat: 0,
      fiber: 1.7,
      salt: 0.01,
    },
    servings: [
      { label: '1 medium onion', amount: 110 },
      { label: 'half an onion', amount: 55 },
    ],
  },
  {
    seedKey: 'garlic',
    name: 'Garlic',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 149,
      protein: 6.4,
      carbs: 33,
      sugars: 1,
      fat: 0.5,
      saturatedFat: 0.1,
      fiber: 2.1,
      salt: 0.04,
    },
    servings: [
      { label: '1 clove', amount: 5 },
    ],
  },
  {
    seedKey: 'tomato',
    name: 'Tomato',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 18,
      protein: 0.9,
      carbs: 3.9,
      sugars: 2.6,
      fat: 0.2,
      saturatedFat: 0,
      fiber: 1.2,
      salt: 0.01,
    },
    servings: [
      { label: '1 medium tomato', amount: 120 },
      { label: '1 cherry tomato', amount: 17 },
    ],
  },
  {
    seedKey: 'carrot',
    name: 'Carrot',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 41,
      protein: 0.9,
      carbs: 9.6,
      sugars: 4.7,
      fat: 0.2,
      saturatedFat: 0,
      fiber: 2.8,
      salt: 0.17,
    },
    servings: [
      { label: '1 medium carrot', amount: 70 },
    ],
  },
  {
    seedKey: 'bell-pepper-red',
    name: 'Bell pepper, red',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 31,
      protein: 1,
      carbs: 6,
      sugars: 4.2,
      fat: 0.3,
      saturatedFat: 0,
      fiber: 2.1,
      salt: 0.01,
    },
    servings: [
      { label: '1 pepper', amount: 150 },
      { label: 'half a pepper', amount: 75 },
    ],
  },
  {
    seedKey: 'spinach',
    name: 'Spinach',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 23,
      protein: 2.9,
      carbs: 3.6,
      sugars: 0.4,
      fat: 0.4,
      saturatedFat: 0.1,
      fiber: 2.2,
      salt: 0.2,
    },
    servings: [
      { label: '1 handful', amount: 30 },
      { label: '1 bag', amount: 200 },
    ],
  },
  {
    seedKey: 'banana',
    name: 'Banana',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      sugars: 12.2,
      fat: 0.3,
      saturatedFat: 0.1,
      fiber: 2.6,
      salt: 0,
    },
    servings: [
      { label: '1 medium banana', amount: 118 },
      { label: '1 small banana', amount: 90 },
    ],
    servingSize: 118,
    servingLabel: '1 medium banana (118 g)',
  },
  {
    seedKey: 'apple',
    name: 'Apple',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 52,
      protein: 0.3,
      carbs: 13.8,
      sugars: 10.4,
      fat: 0.2,
      saturatedFat: 0,
      fiber: 2.4,
      salt: 0,
    },
    servings: [
      { label: '1 medium apple', amount: 150 },
    ],
    servingSize: 150,
    servingLabel: '1 medium apple (150 g)',
  },

  // Bakery
  {
    seedKey: 'bread-wholemeal',
    name: 'Bread, wholemeal',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 247,
      protein: 10.5,
      carbs: 41.5,
      sugars: 3.4,
      fat: 2.9,
      saturatedFat: 0.6,
      fiber: 6,
      salt: 1,
    },
    servings: [
      { label: '1 slice', amount: 40 },
      { label: '2 slices', amount: 80 },
    ],
    servingSize: 40,
    servingLabel: '1 slice (40 g)',
  },
  {
    seedKey: 'oats-rolled',
    name: 'Oats, rolled',
    baseUnit: 'g',
    nutritionPer100: {
      calories: 379,
      protein: 13.2,
      carbs: 67.7,
      sugars: 1,
      fat: 6.5,
      saturatedFat: 1.1,
      fiber: 10.1,
      salt: 0.01,
    },
    servings: [
      { label: '1 portion', amount: 40 },
      { label: '1 cup', amount: 90 },
    ],
    servingSize: 40,
    servingLabel: '1 portion (40 g)',
  },
]
