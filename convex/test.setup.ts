/// <reference types="vite/client" />

// convex/tsconfig.json sets `types: ["node"]`, so ImportMeta has no `glob`
// without the reference above. Only convex-test consumes this file.
export const modules = import.meta.glob('./**/*.*s')
