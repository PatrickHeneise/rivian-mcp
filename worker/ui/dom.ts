// Minimal element builders. Text goes through textContent, never innerHTML.

type Child = Node | string | null | undefined | false
type Attrs = Record<string, string | number | boolean | EventListener | undefined>

export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  return build(document.createElement(tag), attrs, children)
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function s(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  return build(document.createElementNS(SVG_NS, tag), attrs, children)
}

function build<E extends Element>(el: E, attrs: Attrs, children: Child[]): E {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, ''), value)
    else el.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    el.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return el
}

const disposers: (() => void)[] = []

/** Registers cleanup for something the current screen owns, such as a map or an observer. */
export function onTeardown(fn: () => void): void {
  disposers.push(fn)
}

/** Runs and clears the cleanups. Call before replacing the screen. */
export function teardown(): void {
  for (const fn of disposers.splice(0)) fn()
}
