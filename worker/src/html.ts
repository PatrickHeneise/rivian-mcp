// Pure helpers for the sign-in pages.

export const esc = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Copies `extra` onto `base`, keeping every Set-Cookie. */
export function merge(base: Headers | undefined, extra: Headers): Headers {
  const headers = new Headers(base)
  for (const [name, value] of extra) {
    if (name.toLowerCase() !== 'set-cookie') headers.set(name, value)
  }
  for (const cookie of extra.getSetCookie()) headers.append('Set-Cookie', cookie)
  return headers
}
