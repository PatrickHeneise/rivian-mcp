// The three screens: one drive, period stats, charging sessions.

import type { ChargeSessionView, ChargingView, DriveView, StatsView } from '../src/app-data.ts'
import { type Bar, barChart, lineChart } from './chart.ts'
import { h } from './dom.ts'
import { dayKey, dayRange, type Formatter, partOfDay } from './format.ts'
import { routeMap } from './map.ts'

export interface Ctx {
  fmt: Formatter
  dark: boolean
  /** Open one drive from a list or map. */
  openDrive: (id: string) => void
  /** Reload stats or charging for another period. */
  setDays: (kind: 'stats' | 'charging', days: number) => void
  /** Return to the previous screen, when there is one. */
  back?: () => void
  /** Header controls shared by every screen, such as the units toggle. */
  toolbar: HTMLElement
}

const PERIODS = [7, 30, 90, 365]
/** show_charging takes at most 90 days (src/apps.ts). */
const CHARGING_PERIODS = PERIODS.filter((n) => n <= 90)

export function driveScreen(view: DriveView, ctx: Ctx): HTMLElement {
  const { fmt } = ctx
  const d = view.drive
  const avgMps = d.durationMs > 0 ? d.distanceM / (d.durationMs / 1000) : 0
  const elev = d.elevation
  const track = view.track

  const tiles = [
    d.efficiencyKmPerKwh === null
      ? tile('Efficiency', ['-', ''], 'No energy measured')
      : tile(
          'Efficiency',
          fmt.efficiency(d.efficiencyKmPerKwh),
          `${fmt.distance(d.distanceM).join(' ')} on ${fmt.number(d.energyKwh ?? 0, 1)} kWh`,
        ),
    tile('Distance', fmt.distance(d.distanceM), odometer(d.startOdometerKm, d.endOdometerKm, fmt)),
    tile('Speed', fmt.speed(avgMps), `${fmt.speed(d.maxSpeedMps).join(' ')} max`),
    d.energyKwh === null
      ? tile('Energy', ['-', ''], 'No battery samples')
      : tile(
          'Energy',
          [fmt.number(d.energyKwh, 2), 'kWh'],
          `${fmt.number(d.socStartPct ?? 0, 1)}% → ${fmt.number(d.socEndPct ?? 0, 1)}%`,
        ),
    elev
      ? tile(
          'Elevation',
          fmt.height(elev.gainM - elev.lossM),
          `↑ ${fmt.height(elev.gainM).join(' ')}  ↓ ${fmt.height(elev.lossM).join(' ')}`,
        )
      : tile('Elevation', ['-', ''], 'No altitude data'),
  ]

  const alt = track
    .filter((p) => p[3] !== null)
    .map((p): [number, number] => [p[0], fmt.heightValue(p[3] as number)])
  const speed = track
    .filter((p) => p[4] !== null)
    .map((p): [number, number] => [p[0], fmt.speedValue(p[4] as number)])
  const time = (ms: number) => fmt.time(ms)
  const heightUnit = fmt.height(0)[1]
  const speedUnit = fmt.speed(0)[1]

  return h(
    'article',
    { class: 'card' },
    header(
      `${partOfDay(d.startedAt, fmt.timeZone)} drive`,
      [
        fmt.date(d.startedAt, { weekday: 'short', month: 'short', day: 'numeric' }),
        `${fmt.time(d.startedAt)} – ${d.endedAt ? fmt.time(d.endedAt) : 'now'}`,
        fmt.duration(d.durationMs),
      ].join(' · '),
      ctx,
      { badge: d.endedAt === null ? 'In progress' : undefined },
    ),
    h('div', { class: 'tiles' }, ...tiles),
    routeMap({
      dark: ctx.dark,
      routes: [{ points: track.map((p) => [p[1], p[2]]) }],
      endpoints: true,
    }),
    h(
      'div',
      { class: 'charts' },
      alt.length > 1 &&
        section(
          'Elevation',
          lineChart({
            points: alt,
            area: true,
            formatX: time,
            formatY: (y, digits) => `${fmt.number(y, digits)} ${heightUnit}`,
            tooltip: (x, y) => `${time(x)} · ${fmt.number(y, 0)} ${heightUnit}`,
          }),
        ),
      speed.length > 1 &&
        section(
          'Speed',
          lineChart({
            points: speed,
            zero: true,
            formatX: time,
            formatY: (y, digits) => `${fmt.number(y, digits)} ${speedUnit}`,
            tooltip: (x, y) => `${time(x)} · ${fmt.number(y, 0)} ${speedUnit}`,
          }),
        ),
    ),
  )
}

export function statsScreen(view: StatsView, ctx: Ctx): HTMLElement {
  const { fmt } = ctx
  const drives = view.drives
  const days = Math.round((view.to - view.from) / 86_400_000)
  const distance = sum(drives.map((d) => d.distanceM))
  const durationMs = sum(drives.map((d) => (d.endedAt ?? d.startedAt) - d.startedAt))
  const measured = drives.filter((d) => d.energyKwh !== null && d.energyKwh > 0)
  const energy = sum(measured.map((d) => d.energyKwh ?? 0))
  const measuredM = sum(measured.map((d) => d.distanceM))
  const gain = sum(drives.map((d) => d.gainM ?? 0))
  const loss = sum(drives.map((d) => d.lossM ?? 0))
  const longest = drives.reduce<(typeof drives)[number] | null>(
    (best, d) => (best && best.distanceM >= d.distanceM ? best : d),
    null,
  )

  const tiles = [
    tile('Distance', fmt.distance(distance), `${drives.length} drives`),
    tile(
      'Drive time',
      [fmt.duration(durationMs), ''],
      durationMs > 0 ? `${fmt.speed(distance / (durationMs / 1000)).join(' ')} avg` : '',
    ),
    energy > 0
      ? tile(
          'Efficiency',
          fmt.efficiency(measuredM / 1000 / energy),
          `${measured.length} drives measured`,
        )
      : tile('Efficiency', ['-', ''], 'No energy measured'),
    tile(
      'Energy used',
      [fmt.number(energy, 1), 'kWh'],
      `${fmt.distance(measuredM).join(' ')} measured`,
    ),
    tile('Climb', fmt.height(gain), `↓ ${fmt.height(loss).join(' ')} descended`),
    longest
      ? tile(
          'Longest drive',
          fmt.distance(longest.distanceM),
          fmt.date(longest.startedAt, { month: 'short', day: 'numeric' }),
        )
      : tile('Longest drive', ['-', ''], ''),
  ]

  return h(
    'article',
    { class: 'card' },
    header(
      `Last ${days} days`,
      `${fmt.date(view.from, { month: 'short', day: 'numeric' })} – ${fmt.date(view.to, { month: 'short', day: 'numeric', year: 'numeric' })}`,
      ctx,
      { controls: periods(days, (n) => ctx.setDays('stats', n)) },
    ),
    h('div', { class: 'tiles' }, ...tiles),
    routeMap({
      dark: ctx.dark,
      height: 380,
      routes: drives.map((d) => ({
        points: d.route,
        tooltip: `${fmt.date(d.startedAt, { month: 'short', day: 'numeric' })} · ${fmt.distance(d.distanceM).join(' ')}`,
        onClick: () => ctx.openDrive(d.id),
      })),
    }),
    h(
      'div',
      { class: 'charts' },
      section(
        'Distance per day',
        barChart(
          dailyBars(view, fmt),
          (y, digits) => `${fmt.number(y, digits)} ${fmt.distance(0)[1]}`,
        ),
      ),
      view.capacity.length > 1 &&
        section(
          'Pack capacity',
          lineChart({
            points: view.capacity,
            formatX: (x) => fmt.date(x, { month: 'short', day: 'numeric' }),
            formatY: (y, digits) => fmt.number(y, digits),
            tooltip: (x, y) =>
              `${fmt.date(x, { month: 'short', day: 'numeric' })} · ${fmt.number(y, 2)} kWh`,
          }),
        ),
    ),
    section('Drives', driveTable(view, ctx)),
    view.skipped > 0 &&
      h(
        'p',
        { class: 'note' },
        `${view.skipped} drives left out as GPS noise: under ${fmt.distance(view.minDriveM).join(' ')}, or averaging under ${fmt.speed(view.minAvgSpeedMps).join(' ')}.`,
      ),
  )
}

export function chargingScreen(
  view: ChargingView,
  ctx: Ctx,
  selected: number,
  select: (i: number) => void,
): HTMLElement {
  const { fmt } = ctx
  const days = Math.round((view.to - view.from) / 86_400_000)
  const sessions = view.sessions
  const energy = sum(sessions.map((s) => s.energyKwh))
  const durationMs = sum(sessions.map((s) => s.endedAt - s.startedAt))
  const session = sessions[selected]

  return h(
    'article',
    { class: 'card' },
    header(
      'Charging',
      `Last ${days} days · ${fmt.date(view.from, { month: 'short', day: 'numeric' })} – ${fmt.date(view.to, { month: 'short', day: 'numeric' })}`,
      ctx,
      { controls: periods(days, (n) => ctx.setDays('charging', n), CHARGING_PERIODS) },
    ),
    h(
      'div',
      { class: 'tiles' },
      tile('Sessions', [String(sessions.length), ''], ''),
      tile('Energy added', [fmt.number(energy, 1), 'kWh'], 'from SoC × pack capacity'),
      tile('Time charging', [fmt.duration(durationMs), ''], ''),
      tile(
        'Avg power',
        durationMs > 0 ? [fmt.number(energy / (durationMs / 3_600_000), 1), 'kW'] : ['-', ''],
        '',
      ),
    ),
    sessions.length === 0
      ? h('p', { class: 'empty' }, 'No charging sessions in this period.')
      : h(
          'div',
          { class: 'split' },
          h(
            'ul',
            { class: 'sessions' },
            ...sessions.map((s, i) =>
              h(
                'li',
                {},
                h(
                  'button',
                  { class: i === selected ? 'row active' : 'row', onclick: () => select(i) },
                  h(
                    'span',
                    {},
                    fmt.date(s.startedAt, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  ),
                  h(
                    'span',
                    { class: 'muted' },
                    `${fmt.number(s.socStartPct, 0)}% → ${fmt.number(s.socEndPct, 0)}%`,
                  ),
                  h('span', {}, `${fmt.number(s.energyKwh, 1)} kWh`),
                ),
              ),
            ),
          ),
          session && sessionDetail(session, fmt),
        ),
  )
}

function sessionDetail(s: ChargeSessionView, fmt: Formatter): HTMLElement {
  const time = (ms: number) => fmt.time(ms)
  return h(
    'div',
    { class: 'session' },
    h(
      'div',
      { class: 'tiles' },
      tile(
        'Energy added',
        [fmt.number(s.energyKwh, 1), 'kWh'],
        `${fmt.number(s.socStartPct, 1)}% → ${fmt.number(s.socEndPct, 1)}%`,
      ),
      tile('Avg power', [fmt.number(s.avgKw, 1), 'kW'], fmt.duration(s.endedAt - s.startedAt)),
      tile(
        'Peak power',
        s.peakKw === null ? ['-', ''] : [fmt.number(s.peakKw, 1), 'kW'],
        'reported, unconfirmed',
      ),
    ),
    s.soc.length > 1 &&
      section(
        'State of charge',
        lineChart({
          points: s.soc,
          formatX: time,
          formatY: (y, digits) => `${fmt.number(y, digits)}%`,
          tooltip: (x, y) => `${time(x)} · ${fmt.number(y, 1)}%`,
        }),
      ),
    s.power.length > 1 &&
      section(
        'Reported power (unconfirmed field)',
        lineChart({
          points: s.power,
          area: true,
          zero: true,
          formatX: time,
          formatY: (y, digits) => `${fmt.number(y, digits)} kW`,
          tooltip: (x, y) => `${time(x)} · ${fmt.number(y, 1)} kW`,
        }),
      ),
  )
}

function driveTable(view: StatsView, ctx: Ctx): HTMLElement {
  const { fmt } = ctx
  if (view.drives.length === 0) return h('p', { class: 'empty' }, 'No drives in this period.')
  return h(
    'table',
    { class: 'drives' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        ...['Date', 'Distance', 'Time', 'Efficiency', 'Energy'].map((t) => h('th', {}, t)),
      ),
    ),
    h(
      'tbody',
      {},
      ...view.drives.map((d) =>
        h(
          'tr',
          {
            tabindex: 0,
            onclick: () => ctx.openDrive(d.id),
            onkeydown: enter(() => ctx.openDrive(d.id)),
          },
          h(
            'td',
            {},
            fmt.date(d.startedAt, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
          ),
          h('td', {}, fmt.distance(d.distanceM).join(' ')),
          h('td', {}, d.endedAt ? fmt.duration(d.endedAt - d.startedAt) : 'in progress'),
          h(
            'td',
            {},
            d.efficiencyKmPerKwh === null ? '-' : fmt.efficiency(d.efficiencyKmPerKwh).join(' '),
          ),
          h('td', {}, d.energyKwh === null ? '-' : `${fmt.number(d.energyKwh, 1)} kWh`),
        ),
      ),
    ),
  )
}

function dailyBars(view: StatsView, fmt: Formatter): Bar[] {
  const perDay = new Map<string, number>()
  for (const d of view.drives) {
    const key = dayKey(d.startedAt, fmt.timeZone)
    perDay.set(key, (perDay.get(key) ?? 0) + d.distanceM)
  }
  const bars: Bar[] = []
  for (const [y, mo, d] of dayRange(view.from, view.to, fmt.timeZone)) {
    const m = perDay.get(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`) ?? 0
    const label = fmt.date(Date.UTC(y, mo - 1, d, 12), {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    })
    bars.push({
      label,
      value: fmt.distanceValue(m),
      tooltip: `${label} · ${fmt.distance(m).join(' ')}`,
    })
  }
  return bars
}

function header(
  title: string,
  subtitle: string,
  ctx: Ctx,
  extra: { badge?: string; controls?: HTMLElement } = {},
): HTMLElement {
  return h(
    'header',
    {},
    h(
      'div',
      { class: 'title' },
      ctx.back && h('button', { class: 'back', onclick: ctx.back, 'aria-label': 'Back' }, '←'),
      h('h1', {}, title),
      extra.badge && h('span', { class: 'badge' }, extra.badge),
    ),
    h('p', { class: 'sub' }, subtitle),
    h('div', { class: 'controls' }, extra.controls, ctx.toolbar),
  )
}

function periods(current: number, onPick: (days: number) => void, options = PERIODS): HTMLElement {
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Period' },
    ...options.map((n) =>
      h(
        'button',
        { class: n === current ? 'active' : '', onclick: () => onPick(n) },
        n === 365 ? '1 y' : `${n} d`,
      ),
    ),
  )
}

function tile(label: string, [value, unit]: [string, string], sub: string): HTMLElement {
  return h(
    'div',
    { class: 'tile' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value, unit && h('span', { class: 'unit' }, unit)),
    sub && h('div', { class: 'hint' }, sub),
  )
}

function section(title: string, body: HTMLElement): HTMLElement {
  return h('section', {}, h('h2', {}, title), body)
}

function odometer(start: number | null, end: number | null, fmt: Formatter): string {
  if (start === null || end === null) return ''
  const [from] = fmt.distance(start * 1000)
  const [to, unit] = fmt.distance(end * 1000)
  return `${from} → ${to} ${unit}`
}

const enter = (fn: () => void) => (event: Event) => {
  if ((event as KeyboardEvent).key === 'Enter') fn()
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
