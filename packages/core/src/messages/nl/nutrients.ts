import type {
  labels as enLabels,
  nutrients as enNutrients,
  sources as enSources,
} from '../en/nutrients'

export const labels = {
  calories: 'Calorieën (kcal)',
  protein: 'Eiwitten (g)',
  carbs: 'Koolhydraten (g)',
  sugars: 'Suikers (g)',
  fat: 'Vet (g)',
  saturatedFat: 'Verzadigd vet (g)',
  fiber: 'Vezels (g)',
  salt: 'Zout (g)',
} satisfies typeof enLabels

export const sources = {
  imported: 'Geïmporteerd',
  ai: 'AI-schatting',
  manual: 'Handmatig',
} satisfies typeof enSources

export const nutrients = { labels, sources } satisfies typeof enNutrients
