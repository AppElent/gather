// Lets Node run `@gather/core` TypeScript directly: core imports its own
// files without an extension ("./aisles"), as the bundlers expect, and Node's
// own resolver does not try `.ts`. Used only by the scripts in this folder:
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/eval.ts
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      const relative = specifier.startsWith('.') || specifier.startsWith('/')
      if (!relative || error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context)
        } catch {}
      }
      throw error
    }
  },
})
