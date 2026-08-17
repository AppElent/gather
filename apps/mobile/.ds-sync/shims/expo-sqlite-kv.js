// Browser shim for `expo-sqlite/kv-store`: the app needs a synchronous
// key/value store before first paint, and a preview has nothing to persist.
const memory = new Map()

// Probe affordance: `?scheme=dark` seeds the stored appearance, so the dark
// palette can be verified through the real provider rather than a fake.
const seeded = new URLSearchParams(globalThis.location?.search ?? '').get(
  'scheme',
)
if (seeded) memory.set('gather:appearance', seeded)

const Storage = {
  getItemSync: (key) => (memory.has(key) ? memory.get(key) : null),
  setItemSync: (key, value) => {
    memory.set(key, value)
  },
  removeItemSync: (key) => {
    memory.delete(key)
  },
  getItem: async (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: async (key, value) => {
    memory.set(key, value)
  },
  removeItem: async (key) => {
    memory.delete(key)
  },
}

export default Storage
