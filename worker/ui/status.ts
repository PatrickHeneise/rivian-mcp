// The status screen: the vehicle diagram, lock state, battery, charging, software and alerts.

import type { Activity, Corner, StatusView } from '../src/app-data.ts'
import { carDiagram, openingState } from './car.ts'
import { h } from './dom.ts'
import type { Formatter } from './format.ts'
import { routeMap } from './map.ts'
import { type Ctx, header, section, tile } from './views.ts'

const ACTIVITY: Record<Activity, string> = {
  driving: 'Driving',
  charging: 'Charging',
  parked: 'Parked',
  asleep: 'Asleep',
}

const CORNERS: [Corner, string][] = [
  ['fl', 'front left'],
  ['fr', 'front right'],
  ['rl', 'rear left'],
  ['rr', 'rear right'],
]

export function statusScreen(view: StatusView, ctx: Ctx): HTMLElement {
  const { fmt } = ctx
  const v = view.vehicle
  const model = [v.modelYear, v.model].filter(Boolean).join(' ')
  const sub = [
    v.name ? model : null,
    view.online === null ? null : view.online ? 'Online' : 'Offline',
    view.lastSyncAt ? `synced ${ago(view.lastSyncAt, view.at)}` : null,
    `read ${fmt.time(view.at)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const refresh = h(
    'button',
    { class: 'icon', onclick: ctx.refresh, 'aria-label': 'Refresh', title: 'Refresh' },
    '↻',
  )

  return h(
    'article',
    { class: 'card dash' },
    header(v.name ?? model, sub, ctx, { badge: ACTIVITY[view.activity], controls: refresh }),
    h('div', { class: 'hero' }, h('div', { class: 'car-wrap' }, carDiagram(view)), lockPanel(view)),
    h('div', { class: 'tiles' }, ...tiles(view, fmt)),
    attention(view),
    h(
      'div',
      { class: 'charts' },
      section('Software', software(view, ctx)),
      view.location &&
        section(
          view.location.place ? `Near ${view.location.place}` : 'Location',
          routeMap({
            dark: ctx.dark,
            routes: [],
            pin: [view.location.lat, view.location.lon],
            height: 200,
          }),
        ),
    ),
    h(
      'p',
      { class: 'note' },
      'Unofficial. Read only: this view cannot lock, unlock or change anything.',
    ),
  )
}

function lockPanel(view: StatusView): HTMLElement {
  const unlocked = [
    ...CORNERS.filter(([c]) => view.doors[c].locked === false).map(([, n]) => `${n} door`),
    ...view.closures.filter((c) => c.locked === false).map((c) => c.label.toLowerCase()),
  ]
  const lockCovered =
    CORNERS.every(([c]) => view.doors[c].locked !== null) &&
    view.closures.every((c) => c.locked !== null)
  const headline =
    view.locked === null
      ? 'Lock state unknown'
      : view.locked
        ? lockCovered
          ? 'Locked'
          : 'Locked, incomplete'
        : 'Unlocked'
  const detail =
    view.locked === null
      ? 'The vehicle sent no lock signal.'
      : view.locked
        ? lockCovered
          ? 'All doors and closures'
          : 'Only the doors and closures that reported'
        : capitalize(unlocked.join(', '))

  const openDoors = CORNERS.filter(([c]) => view.doors[c].open).map(([, n]) => n)
  const openWindows = CORNERS.filter(([c]) => view.windows[c]).map(([, n]) => n)
  const allDoors = CORNERS.every(([c]) => view.doors[c].open !== null)
  const anyDoor = CORNERS.some(([c]) => view.doors[c].open !== null)
  const allWindows = CORNERS.every(([c]) => view.windows[c] !== null)
  const anyWindow = CORNERS.some(([c]) => view.windows[c] !== null)
  const lowTires = CORNERS.filter(([c]) => view.tires[c] === 'low' || view.tires[c] === 'critical')
  const allTires = CORNERS.every(([c]) => view.tires[c] !== null)
  const anyTire = CORNERS.some(([c]) => view.tires[c] !== null)

  const rows: [string, string, string][] = []
  if (anyDoor) {
    rows.push([
      'Doors',
      openDoors.length
        ? `Open: ${openDoors.join(', ')}`
        : allDoors
          ? 'Closed'
          : 'Closed where reported',
      openDoors.length ? 'open' : allDoors ? 'closed' : 'neutral',
    ])
  }
  if (anyWindow) {
    rows.push([
      'Windows',
      openWindows.length
        ? `Open: ${openWindows.join(', ')}`
        : allWindows
          ? 'Closed'
          : 'Closed where reported',
      openWindows.length ? 'unlocked' : allWindows ? 'closed' : 'neutral',
    ])
  }
  for (const c of view.closures) {
    const state = openingState(c)
    rows.push([
      c.label,
      state === 'open'
        ? 'Open'
        : state === 'unlocked'
          ? 'Closed, unlocked'
          : state === 'closed'
            ? 'Closed'
            : 'No signal',
      state,
    ])
  }
  if (anyTire) {
    rows.push([
      'Tires',
      lowTires.length
        ? lowTires.map(([c, n]) => `${capitalize(n)} ${view.tires[c]}`).join(', ')
        : allTires
          ? 'Pressure OK'
          : 'OK where reported',
      lowTires.some(([c]) => view.tires[c] === 'critical')
        ? 'open'
        : lowTires.length
          ? 'unlocked'
          : allTires
            ? 'closed'
            : 'neutral',
    ])
  }
  if (view.gearGuardLocked !== null) {
    rows.push(['Gear Guard', view.gearGuardLocked ? 'On' : 'Off', 'neutral'])
  }

  return h(
    'div',
    { class: 'lock-panel' },
    h(
      'div',
      {
        class: `lock-head ${view.locked === null ? 'unknown' : view.locked ? 'locked' : 'unlocked'}`,
      },
      h('div', { class: 'lock-title' }, headline),
      h('div', { class: 'hint' }, detail),
    ),
    h(
      'ul',
      { class: 'checks' },
      ...rows.map(([label, value, state]) =>
        h(
          'li',
          {},
          h('span', { class: `dot ${state}`, 'aria-hidden': 'true' }),
          h('span', { class: 'muted' }, label),
          h('span', {}, value),
        ),
      ),
    ),
  )
}

function tiles(view: StatusView, fmt: Formatter): HTMLElement[] {
  const b = view.battery
  const c = view.charging
  const out: HTMLElement[] = []

  const battery = tile(
    'Battery',
    b.socPct === null ? ['-', ''] : [fmt.number(b.socPct, 0), '%'],
    b.limitPct === null ? '' : `Limit ${b.limitPct}%`,
  )
  if (b.socPct !== null) battery.append(meter(b.socPct, b.limitPct, view.activity === 'charging'))
  out.push(battery)

  out.push(
    b.rangeM !== null
      ? tile('Range', fmt.distance(b.rangeM), b.low ? 'Low range' : 'Estimated')
      : tile(
          'Range',
          b.rangeRaw === null ? ['-', ''] : [fmt.number(b.rangeRaw, 0), ''],
          b.rangeRaw === null ? '' : 'In the vehicle’s distance unit',
        ),
  )

  const chargeLabel =
    c.state === null
      ? '-'
      : {
          unplugged: 'Unplugged',
          plugged: 'Plugged in',
          charging: 'Charging',
          complete: 'Complete',
        }[c.state]
  const chargeHint = [
    c.powerKw !== null ? `${fmt.number(c.powerKw, 1)} kW reported` : null,
    c.minutesToFull !== null ? `${fmt.duration(c.minutesToFull * 60_000)} to limit` : null,
    c.disabled ? 'Charging disabled' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const charge = tile('Charging', [chargeLabel, ''], chargeHint)
  charge.classList.add('charge', c.state ?? 'unknown')
  out.push(charge)

  if (view.drive) {
    out.push(
      tile(
        'Current drive',
        fmt.distance(view.drive.distanceM),
        `since ${fmt.time(view.drive.startedAt)}`,
      ),
    )
  }

  const cabin = view.cabin
  if (cabin.tempC !== null) {
    out.push(
      tile(
        'Cabin',
        temperature(cabin.tempC, fmt),
        [
          cabin.preconditioning ? 'Preconditioning' : null,
          cabin.setpointC !== null ? `Set to ${temperature(cabin.setpointC, fmt).join('')}` : null,
          cabin.petMode ? 'Pet mode' : null,
          cabin.defrost ? 'Defrost' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    )
  }

  if (view.odometerM !== null) {
    out.push(
      tile(
        'Odometer',
        fmt.distance(view.odometerM),
        [
          view.driveMode && capitalize(view.driveMode.replaceAll('_', ' ')),
          view.gear && capitalize(view.gear),
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    )
  }
  return out
}

/** State of charge as a bar, with the charge limit as a tick. */
function meter(socPct: number, limitPct: number | null, charging: boolean): HTMLElement {
  const clamp = (n: number) => Math.max(0, Math.min(100, n))
  return h(
    'div',
    {
      class: `meter${charging ? ' charging' : ''}${socPct < 20 ? ' low' : ''}`,
      role: 'meter',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(socPct),
      'aria-label': 'State of charge',
    },
    h('div', { class: 'fill', style: `width:${clamp(socPct)}%` }),
    limitPct !== null && h('div', { class: 'limit', style: `left:${clamp(limitPct)}%` }),
  )
}

function attention(view: StatusView): HTMLElement {
  if (view.alerts.length === 0) {
    return h('p', { class: 'all-clear' }, 'Nothing needs attention.')
  }
  return section(
    'Needs attention',
    h(
      'ul',
      { class: 'alerts' },
      ...view.alerts.map((a) =>
        h('li', { class: a.level }, h('span', { class: 'level' }, a.level), a.text),
      ),
    ),
  )
}

function software(view: StatusView, ctx: Ctx): HTMLElement {
  const sw = view.software
  const notes = (url: string | null, label: string) =>
    url && h('button', { class: 'link', onclick: () => ctx.openLink(url) }, label)
  const progress = (label: string, pct: number | null) =>
    pct !== null &&
    h(
      'div',
      { class: 'progress' },
      h('span', { class: 'muted' }, `${label} ${Math.round(pct)}%`),
      h(
        'div',
        { class: 'meter' },
        h('div', { class: 'fill', style: `width:${Math.max(0, Math.min(100, pct))}%` }),
      ),
    )
  const upToDate = sw.status === 'Up to date'
  return h(
    'div',
    { class: 'software' },
    h(
      'div',
      { class: 'version' },
      h('span', { class: 'value' }, sw.current ?? '-'),
      sw.status && h('span', { class: `badge ${upToDate ? 'ok' : 'pending'}` }, sw.status),
    ),
    sw.available &&
      h(
        'p',
        { class: 'update' },
        `Version ${sw.available} is available`,
        sw.installDurationMin ? `, about ${sw.installDurationMin} min to install.` : '.',
      ),
    progress('Download', sw.downloadPct),
    progress('Install', sw.installPct),
    h(
      'div',
      { class: 'links' },
      notes(sw.availableNotesUrl, `What’s new in ${sw.available ?? 'the update'}`),
      notes(sw.currentNotesUrl, 'Current release notes'),
    ),
  )
}

/** imperial shows °F. */
function temperature(celsius: number, fmt: Formatter): [string, string] {
  return fmt.units === 'imperial'
    ? [fmt.number((celsius * 9) / 5 + 32, 0), '°F']
    : [fmt.number(celsius, 0), '°C']
}

function ago(ms: number, now: number): string {
  const minutes = Math.round((now - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
