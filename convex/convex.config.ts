import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'
import { defineApp } from 'convex/server'

const app = defineApp()
// How often a paired watch may call (`watch.ts`, APP-653).
app.use(rateLimiter)

export default app
