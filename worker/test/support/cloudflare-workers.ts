// Test stand-in for the `cloudflare:workers` module, which only exists in the Workers runtime.
export class DurableObject<E> {
  ctx: unknown
  env: E
  constructor(ctx: unknown, env: E) {
    this.ctx = ctx
    this.env = env
  }
}
