// Resolves `cloudflare:workers` to a local stand-in, so Worker modules load under node:test.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier !== 'cloudflare:workers') return next(specifier, context)
    const url = new URL('./cloudflare-workers.ts', import.meta.url).href
    return { url, shortCircuit: true }
  },
})
