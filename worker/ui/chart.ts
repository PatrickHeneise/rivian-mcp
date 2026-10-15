// SVG charts: one series per chart, one y-axis, hover crosshair and tooltip.
// Charts redraw when their container width changes.

import { h, onTeardown, s } from './dom.ts'

const HEIGHT = 160
const PAD = { top: 12, right: 12, bottom: 22, left: 44 }

export interface LineChartOptions {
  /** [x, y] sorted by x. */
  points: [number, number][]
  area?: boolean
  formatX: (x: number) => string
  /** Tick label. `digits` is the decimals the tick step needs. */
  formatY: (y: number, digits: number) => string
  /** Tooltip text for one point. */
  tooltip: (x: number, y: number) => string
  /** Include zero on the y-axis. */
  zero?: boolean
}

export function lineChart(opts: LineChartOptions): HTMLElement {
  return responsive((width) => drawLine(width, opts))
}

export interface Bar {
  label: string
  value: number
  tooltip: string
}

export function barChart(bars: Bar[], formatY: (y: number, digits: number) => string): HTMLElement {
  return responsive((width) => drawBars(width, bars, formatY))
}

function responsive(draw: (width: number) => HTMLElement): HTMLElement {
  const box = h('div', { class: 'chart' })
  let lastWidth = 0
  const observer = new ResizeObserver(([entry]) => {
    const width = Math.floor(entry.contentRect.width)
    if (width === lastWidth || width === 0) return
    lastWidth = width
    box.replaceChildren(draw(width))
  })
  observer.observe(box)
  onTeardown(() => observer.disconnect())
  return box
}

function drawLine(width: number, opts: LineChartOptions): HTMLElement {
  const { points } = opts
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [x0, x1] = [xs[0], xs[xs.length - 1]]
  const ticks = niceTicks(opts.zero ? Math.min(0, ...ys) : Math.min(...ys), Math.max(...ys))
  const [y0, y1] = [ticks[0], ticks[ticks.length - 1]]
  const digits = tickDigits(ticks)
  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const px = (x: number) => PAD.left + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW)
  const py = (y: number) =>
    PAD.top + plotH - (y1 === y0 ? plotH / 2 : ((y - y0) / (y1 - y0)) * plotH)

  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`)
  const base = py(Math.max(y0, Math.min(0, y1)))
  const svg = s(
    'svg',
    {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      role: 'img',
      'aria-label': `Line chart from ${opts.formatX(x0)} to ${opts.formatX(x1)}`,
    },
    ...gridLines(ticks, width, py, (t) => opts.formatY(t, digits)),
    s('text', { class: 'axis', x: PAD.left, y: HEIGHT - 4 }, opts.formatX(x0)),
    s(
      'text',
      { class: 'axis', x: width - PAD.right, y: HEIGHT - 4, 'text-anchor': 'end' },
      opts.formatX(x1),
    ),
    opts.area &&
      s('path', {
        class: 'area',
        d: `${line.join('')}L${px(x1).toFixed(1)},${base}L${px(x0).toFixed(1)},${base}Z`,
      }),
    s('path', { class: 'line', d: line.join('') }),
  )

  const cross = s('line', {
    class: 'cross',
    y1: PAD.top,
    y2: PAD.top + plotH,
    visibility: 'hidden',
  })
  const dot = s('circle', { class: 'dot', r: 4, visibility: 'hidden' })
  svg.append(cross, dot)
  const tip = h('div', { class: 'tip', hidden: true })
  const hide = () => {
    cross.setAttribute('visibility', 'hidden')
    dot.setAttribute('visibility', 'hidden')
    tip.hidden = true
  }
  svg.addEventListener('pointerleave', hide)
  svg.addEventListener('pointermove', (event) => {
    const rect = svg.getBoundingClientRect()
    const x = x0 + ((event.clientX - rect.left - PAD.left) / plotW) * (x1 - x0)
    const i = nearest(xs, x)
    const [px1, py1] = [px(points[i][0]), py(points[i][1])]
    cross.setAttribute('x1', String(px1))
    cross.setAttribute('x2', String(px1))
    cross.setAttribute('visibility', 'visible')
    dot.setAttribute('cx', String(px1))
    dot.setAttribute('cy', String(py1))
    dot.setAttribute('visibility', 'visible')
    tip.textContent = opts.tooltip(points[i][0], points[i][1])
    tip.hidden = false
    tip.style.left = `${Math.min(px1 + 8, width - tip.offsetWidth - 4)}px`
    tip.style.top = `${Math.max(py1 - 34, 0)}px`
  })
  return h('div', { class: 'plot' }, svg, tip)
}

function drawBars(
  width: number,
  bars: Bar[],
  formatY: (y: number, digits: number) => string,
): HTMLElement {
  const ticks = niceTicks(0, Math.max(...bars.map((b) => b.value), 0))
  const top = ticks[ticks.length - 1]
  const digits = tickDigits(ticks)
  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = plotW / Math.max(bars.length, 1)
  const barW = Math.max(Math.min(slot - 2, 24), 1)
  const py = (y: number) => PAD.top + plotH - (top === 0 ? 0 : (y / top) * plotH)
  const tip = h('div', { class: 'tip', hidden: true })
  const svg = s(
    'svg',
    {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      role: 'img',
      'aria-label': `Bar chart with ${bars.length} values`,
    },
    ...gridLines(ticks, width, py, (t) => formatY(t, digits)),
    bars.length > 0 && s('text', { class: 'axis', x: PAD.left, y: HEIGHT - 4 }, bars[0].label),
    bars.length > 1 &&
      s(
        'text',
        { class: 'axis', x: width - PAD.right, y: HEIGHT - 4, 'text-anchor': 'end' },
        bars[bars.length - 1].label,
      ),
  )
  bars.forEach((bar, i) => {
    const x = PAD.left + i * slot + (slot - barW) / 2
    const y = py(bar.value)
    const height = Math.max(PAD.top + plotH - y, bar.value > 0 ? 2 : 0)
    const r = Math.min(4, barW / 2, height)
    // Hit target covers the whole slot, larger than the bar.
    const hit = s('rect', {
      class: 'hit',
      x: PAD.left + i * slot,
      y: PAD.top,
      width: slot,
      height: plotH,
    })
    const mark = s('path', { class: 'bar', d: roundedTop(x, y, barW, height, r) })
    const show = () => {
      tip.textContent = bar.tooltip
      tip.hidden = false
      tip.style.left = `${Math.min(x, width - tip.offsetWidth - 4)}px`
      tip.style.top = `${Math.max(y - 34, 0)}px`
      mark.classList.add('active')
    }
    const hide = () => {
      tip.hidden = true
      mark.classList.remove('active')
    }
    hit.addEventListener('pointerenter', show)
    hit.addEventListener('pointerleave', hide)
    svg.append(mark, hit)
  })
  return h('div', { class: 'plot' }, svg, tip)
}

/** A horizontal gridline and y-axis label per tick. */
function gridLines(
  ticks: number[],
  width: number,
  py: (y: number) => number,
  label: (tick: number) => string,
): SVGElement[] {
  return ticks.map((t) =>
    s(
      'g',
      { class: 'grid' },
      s('line', { x1: PAD.left, x2: width - PAD.right, y1: py(t), y2: py(t) }),
      s('text', { x: PAD.left - 6, y: py(t) + 4, 'text-anchor': 'end' }, label(t)),
    ),
  )
}

/** Bar path with rounded top corners, anchored square to the baseline. */
function roundedTop(x: number, y: number, w: number, height: number, r: number): string {
  if (height <= 0) return ''
  const b = y + height
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`
}

function nearest(xs: number[], x: number): number {
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] < x) lo = mid
    else hi = mid
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi
}

/** Three to five round tick values covering [min, max]. */
export function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1
    return niceTicks(min - pad, max + pad)
  }
  const raw = (max - min) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((st) => st >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let t = start; t < max + step * 0.999; t += step) ticks.push(Number(t.toFixed(10)))
  return ticks
}

/** Decimals needed to tell ticks apart: 0 for steps of 1 or more, 1 for 0.5, 2 for 0.05. */
export function tickDigits(ticks: number[]): number {
  if (ticks.length < 2) return 0
  return Math.max(0, -Math.floor(Math.log10(ticks[1] - ticks[0]) + 1e-9))
}
