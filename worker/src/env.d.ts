// Secrets wrangler types cannot see, since no .dev.vars.example lists them.
interface Env {
  /** Optional. Pins the owner account. Unset, the first accepted sign-in claims the Worker. */
  RIVIAN_EMAIL?: string
}
