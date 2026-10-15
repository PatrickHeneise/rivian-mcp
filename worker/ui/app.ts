// MCP Apps view: renders show_drive, show_stats and show_charging results in the host.
// Opening a drive or switching a period calls the tools again through the host.

import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-with-deps'
import type { AppView } from '../src/app-data.ts'
import { h, teardown } from './dom.ts'
import { defaultUnits, formatter, type Units } from './format.ts'
import { type Ctx, chargingScreen, driveScreen, statsScreen } from './views.ts'
import './app.css'

const UNITS_KEY = 'rivian-mcp:units'
const root = document.getElementById('app') as HTMLElement
const app = new App({ name: 'rivian-mcp', version: '1.0.0' }, {}, { autoResize: true })

let host: McpUiHostContext = {}
/** Screens shown, newest last. Back pops one. */
const stack: AppView[] = []
let selectedSession = 0
let units: Units | null = loadUnits()

app.ontoolinput = () => {
  if (stack.length === 0) status('Loading…')
}
app.ontoolresult = (result) => {
  if (result.isError || !isView(result.structuredContent)) {
    status(textOf(result.content) || 'Nothing to show.')
    return
  }
  stack.length = 0
  show(result.structuredContent)
}
app.ontoolcancelled = () => status('Cancelled.')
app.onhostcontextchanged = (changed) => {
  applyHost({ ...host, ...changed })
  render()
}

app.connect().then(
  () => applyHost(app.getHostContext() ?? {}),
  (error: unknown) => status(`Could not connect to the host: ${String(error)}`),
)

function applyHost(context: McpUiHostContext): void {
  host = context
  if (host.theme) applyDocumentTheme(host.theme)
  if (host.styles?.variables) applyHostStyleVariables(host.styles.variables)
  if (host.styles?.css?.fonts) applyHostFonts(host.styles.css.fonts)
}

function show(view: AppView): void {
  stack.push(view)
  selectedSession = 0
  render()
}

function render(): void {
  const view = stack.at(-1)
  if (!view) return
  teardown()
  const fmt = formatter(units ?? defaultUnits(host.locale), host.locale, host.timeZone)
  const ctx: Ctx = {
    fmt,
    dark: document.documentElement.getAttribute('data-theme') === 'dark' || prefersDark(),
    openDrive,
    setDays,
    back: stack.length > 1 ? back : undefined,
    toolbar: unitsToggle(fmt.units),
  }
  const screen =
    view.kind === 'drive'
      ? driveScreen(view, ctx)
      : view.kind === 'stats'
        ? statsScreen(view, ctx)
        : chargingScreen(view, ctx, selectedSession, (i) => {
            selectedSession = i
            render()
          })
  root.replaceChildren(screen)
}

async function openDrive(id: string): Promise<void> {
  const view = await call('show_drive', { id })
  if (!view) return
  show(view)
  // Lets the model answer follow-up questions about the drive on screen.
  app
    .updateModelContext({ content: [{ type: 'text', text: `The user is viewing drive ${id}.` }] })
    .catch(() => {})
}

async function setDays(kind: 'stats' | 'charging', days: number): Promise<void> {
  const view = await call(kind === 'stats' ? 'show_stats' : 'show_charging', { days })
  if (!view) return
  stack[stack.length - 1] = view
  selectedSession = 0
  render()
}

function back(): void {
  stack.pop()
  render()
}

async function call(name: string, args: Record<string, unknown>): Promise<AppView | null> {
  root.classList.add('busy')
  try {
    const result = await app.callServerTool({ name, arguments: args })
    if (result.isError || !isView(result.structuredContent)) {
      flash(textOf(result.content) || `${name} failed.`)
      return null
    }
    return result.structuredContent
  } catch (error) {
    flash(error instanceof Error ? error.message : String(error))
    return null
  } finally {
    root.classList.remove('busy')
  }
}

function unitsToggle(current: Units): HTMLElement {
  const pick = (next: Units) => () => {
    units = next
    try {
      localStorage.setItem(UNITS_KEY, next)
    } catch {}
    render()
  }
  const button = (value: Units, label: string) =>
    h(
      'button',
      {
        class: current === value ? 'active' : '',
        'aria-pressed': String(current === value),
        onclick: pick(value),
      },
      label,
    )
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Units' },
    button('imperial', 'mi'),
    button('metric', 'km'),
  )
}

function loadUnits(): Units | null {
  try {
    const stored = localStorage.getItem(UNITS_KEY)
    return stored === 'imperial' || stored === 'metric' ? stored : null
  } catch {
    return null
  }
}

function status(message: string): void {
  teardown()
  stack.length = 0
  root.replaceChildren(h('p', { class: 'status' }, message))
}

function flash(message: string): void {
  const note = h('p', { class: 'flash', role: 'alert' }, message)
  root.prepend(note)
  setTimeout(() => note.remove(), 5000)
}

function isView(value: unknown): value is AppView {
  const kind = (value as { kind?: unknown } | undefined)?.kind
  return kind === 'drive' || kind === 'stats' || kind === 'charging'
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c): c is { type: 'text'; text: string } => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

function prefersDark(): boolean {
  return (
    !document.documentElement.hasAttribute('data-theme') &&
    matchMedia('(prefers-color-scheme: dark)').matches
  )
}
