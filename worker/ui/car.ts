// Top-down schematic of the vehicle, front to the right, so its left side is on top.
// Approximate proportions at 13 mm per unit. A diagram, not a likeness: no logo, badge or
// brand colors. Doors and closures take their color from the status; open ones swing out.

import type {
  BodyShape,
  ChargeState,
  ClosureId,
  ClosureStatus,
  Corner,
  Opening,
  StatusView,
  TireStatus,
} from '../src/app-data.ts'
import { s } from './dom.ts'

interface Geometry {
  length: number
  width: number
  frontAxle: number
  rearAxle: number
  /** [rear x, front x] of each door, measured from the rear bumper. */
  frontDoor: [number, number]
  rearDoor: [number, number]
  truck: boolean
  /** Where the charge port is drawn. Null when its position is not known. */
  chargePort: 'front-left' | null
}

const GEOMETRY: Record<BodyShape, Geometry> = {
  R1S: {
    length: 392,
    width: 155,
    frontAxle: 323,
    rearAxle: 86,
    frontDoor: [207, 289],
    rearDoor: [128, 205],
    truck: false,
    chargePort: 'front-left',
  },
  R1T: {
    length: 424,
    width: 155,
    frontAxle: 355,
    rearAxle: 118,
    frontDoor: [239, 321],
    rearDoor: [160, 237],
    truck: true,
    chargePort: 'front-left',
  },
  R2: {
    length: 363,
    width: 147,
    frontAxle: 298,
    rearAxle: 67,
    frontDoor: [182, 264],
    rearDoor: [103, 180],
    truck: false,
    chargePort: null,
  },
}

const VIEW_W = 480
const VIEW_H = 250
const DOOR_SWING = 34
const TIRE_LEN = 58

const CORNER_NAMES: Record<Corner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rl: 'Rear left',
  rr: 'Rear right',
}

/** CSS state class for a door or closure. */
export function openingState(o: Opening | undefined): 'open' | 'unlocked' | 'closed' | 'unknown' {
  if (!o) return 'unknown'
  if (o.open) return 'open'
  if (o.locked === false) return 'unlocked'
  if (o.open === false || o.locked) return 'closed'
  return 'unknown'
}

function describe(o: Opening | undefined): string {
  if (!o) return 'no signal'
  const parts = [
    o.open === null ? null : o.open ? 'open' : 'closed',
    o.locked === null ? null : o.locked ? 'locked' : 'unlocked',
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'no signal'
}

const title = (text: string) => s('title', {}, text)

export function carDiagram(view: StatusView): SVGElement {
  const g = GEOMETRY[view.vehicle.shape]
  const { length: L, width: W } = g
  const x0 = (VIEW_W - L) / 2
  const y0 = (VIEW_H - W) / 2
  const X = (x: number) => x0 + x
  const top = y0
  const bottom = y0 + W
  const closure = (id: ClosureId) => view.closures.find((c) => c.id === id)
  const parts: SVGElement[] = []

  // Body: rounder at the nose than at the tail.
  const rf = 46
  const rr = 20
  parts.push(
    s(
      'path',
      {
        class: 'body',
        d: [
          `M ${X(rr)} ${top}`,
          `L ${X(L - rf)} ${top}`,
          `Q ${X(L)} ${top} ${X(L)} ${top + rf}`,
          `L ${X(L)} ${bottom - rf}`,
          `Q ${X(L)} ${bottom} ${X(L - rf)} ${bottom}`,
          `L ${X(rr)} ${bottom}`,
          `Q ${X(0)} ${bottom} ${X(0)} ${bottom - rr}`,
          `L ${X(0)} ${top + rr}`,
          `Q ${X(0)} ${top} ${X(rr)} ${top}`,
          'Z',
        ].join(' '),
      },
      title(`${view.vehicle.model}, seen from above, front to the right`),
    ),
  )

  // Glass and roof. A truck's cab ends behind the rear doors, then the gear tunnel and bed.
  const cabBack = g.truck ? g.rearDoor[0] - 4 : 16
  const glassFront = g.frontAxle - 40
  parts.push(
    s('rect', {
      class: 'glass',
      x: X(cabBack),
      y: top + 13,
      width: glassFront - cabBack,
      height: W - 26,
      rx: 16,
    }),
    s('rect', {
      class: 'roof',
      x: X(cabBack + (g.truck ? 9 : 16)),
      y: top + 22,
      width: glassFront - 44 - cabBack - (g.truck ? 9 : 16),
      height: W - 44,
      rx: 10,
    }),
  )

  // Side windows sit over the doors, inside the glass.
  for (const [corner, [x1, x2]] of [
    ['fl', g.frontDoor],
    ['rl', g.rearDoor],
    ['fr', g.frontDoor],
    ['rr', g.rearDoor],
  ] as [Corner, [number, number]][]) {
    const open = view.windows[corner]
    const left = corner[1] === 'l'
    parts.push(
      s(
        'rect',
        {
          class: `window ${open ? 'open' : open === false ? 'closed' : 'unknown'}`,
          x: X(x1 + 6),
          y: left ? top + 13 : bottom - 20,
          width: x2 - x1 - 12,
          height: 7,
          rx: 3,
        },
        title(
          `${CORNER_NAMES[corner]} window: ${open === null ? 'no signal' : open ? 'open' : 'closed'}`,
        ),
      ),
    )
  }

  // Frunk lid
  const frunk = closure('frunk')
  parts.push(
    s(
      'rect',
      {
        class: `panel ${openingState(frunk)}`,
        x: X(glassFront + 10),
        y: top + 26,
        width: L - glassFront - 26,
        height: W - 52,
        rx: 16,
      },
      title(`Frunk: ${describe(frunk)}`),
    ),
  )

  if (g.truck) {
    const tunnel: [number, number] = [cabBack - 30, cabBack - 6]
    const tonneau = closure('tonneau')
    const tailgate = closure('tailgate')
    parts.push(
      s(
        'rect',
        {
          class: 'tunnel',
          x: X(tunnel[0]),
          y: top + 6,
          width: tunnel[1] - tunnel[0],
          height: W - 12,
          rx: 4,
        },
        title('Gear tunnel'),
      ),
      s(
        'rect',
        {
          class: `panel bed ${openingState(tonneau)}`,
          x: X(16),
          y: top + 10,
          width: tunnel[0] - 22,
          height: W - 20,
          rx: 6,
        },
        title(`Tonneau cover: ${describe(tonneau)}`),
      ),
      s(
        'rect',
        {
          class: `panel ${openingState(tailgate)}`,
          x: X(3),
          y: top + 12,
          width: 10,
          height: W - 24,
          rx: 3,
        },
        title(`Tailgate: ${describe(tailgate)}`),
      ),
      door(closure('sideBinLeft'), 'Gear tunnel left', tunnel, true),
      door(closure('sideBinRight'), 'Gear tunnel right', tunnel, false),
    )
  } else {
    const liftgate = closure('liftgate')
    parts.push(
      s(
        'rect',
        {
          class: `panel ${openingState(liftgate)}`,
          x: X(3),
          y: top + 14,
          width: 10,
          height: W - 28,
          rx: 3,
        },
        title(`Liftgate: ${describe(liftgate)}`),
      ),
    )
  }

  for (const axle of [g.frontAxle, g.rearAxle]) {
    for (const left of [true, false]) {
      const corner = `${axle === g.frontAxle ? 'f' : 'r'}${left ? 'l' : 'r'}` as Corner
      parts.push(tire(view.tires[corner], CORNER_NAMES[corner], axle, left))
    }
  }

  parts.push(
    door(view.doors.fl, 'Front left door', g.frontDoor, true),
    door(view.doors.rl, 'Rear left door', g.rearDoor, true),
    door(view.doors.fr, 'Front right door', g.frontDoor, false),
    door(view.doors.rr, 'Rear right door', g.rearDoor, false),
    s('ellipse', { class: 'mirror', cx: X(glassFront - 6), cy: top - 7, rx: 9, ry: 5 }),
    s('ellipse', { class: 'mirror', cx: X(glassFront - 6), cy: bottom + 7, rx: 9, ry: 5 }),
  )

  const charge = view.charging.state
  if (g.chargePort && charge && charge !== 'unplugged') {
    parts.push(chargePort(charge, X(g.frontAxle), top + 19))
  }

  const roofCenter = (cabBack + (g.truck ? 9 : 16) + glassFront - 44) / 2
  parts.push(lockBadge(view.locked, view.lockComplete, X(roofCenter), top + W / 2))

  return s(
    'svg',
    {
      class: 'car',
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      role: 'img',
      'aria-label': ariaLabel(view),
    },
    ...parts,
  )

  /** A door or gear tunnel door on one side. It swings out around its front hinge when open. */
  function door(
    o: Opening | ClosureStatus | undefined,
    label: string,
    [x1, x2]: [number, number],
    left: boolean,
  ): SVGElement {
    const state = openingState(o)
    const y = left ? top - 4 : bottom - 4
    const hingeY = left ? top : bottom
    const swing = state === 'open' ? (left ? DOOR_SWING : -DOOR_SWING) : 0
    return s(
      'rect',
      {
        class: `door ${state}`,
        x: X(x1),
        y,
        width: x2 - x1,
        height: 8,
        rx: 3,
        transform: swing ? `rotate(${swing} ${X(x2)} ${hingeY})` : undefined,
      },
      title(`${label}: ${describe(o)}`),
    )
  }

  function tire(status: TireStatus, corner: string, axle: number, left: boolean): SVGElement {
    return s(
      'rect',
      {
        class: `tire ${status ?? 'unknown'}`,
        x: X(axle - TIRE_LEN / 2),
        y: left ? top - 7 : bottom - 13,
        width: TIRE_LEN,
        height: 20,
        rx: 6,
      },
      title(`${corner} tire: ${status === null ? 'no reading' : `pressure ${status}`}`),
    )
  }
}

/** The plugged-in cable at the charge port. */
function chargePort(state: ChargeState, x: number, y: number): SVGElement {
  return s(
    'g',
    { class: `port ${state}` },
    s('path', {
      class: 'cable',
      d: `M ${x} ${y} C ${x} ${y - 36}, ${x + 30} ${y - 48}, ${x + 90} ${y - 52}`,
    }),
    s('circle', { class: 'port-dot', cx: x, cy: y, r: 6 }),
    s(
      'title',
      {},
      state === 'charging' ? 'Charging' : state === 'complete' ? 'Charge complete' : 'Plugged in',
    ),
  )
}

function lockBadge(locked: boolean | null, complete: boolean, cx: number, cy: number): SVGElement {
  const state =
    locked === null || (locked && !complete) ? 'unknown' : locked ? 'locked' : 'unlocked'
  return s(
    'g',
    { class: `lock ${state}`, transform: `translate(${cx} ${cy})` },
    s('circle', { r: 21 }),
    s('path', {
      class: 'shackle',
      d:
        locked === false
          ? 'M -5 -1 V -7 a 5 5 0 0 1 10 0 V -6'
          : 'M -5 -1 V -6 a 5 5 0 0 1 10 0 V -1',
      transform: locked === false ? 'translate(-3 -2)' : undefined,
    }),
    s('rect', { class: 'lock-body', x: -8, y: -1, width: 16, height: 12, rx: 2.5 }),
    s(
      'title',
      {},
      locked === null
        ? 'Lock state unknown'
        : !locked
          ? 'Not locked'
          : complete
            ? 'Locked'
            : 'Locked, incomplete',
    ),
  )
}

function ariaLabel(view: StatusView): string {
  const open = [
    ...(Object.keys(view.doors) as Corner[])
      .filter((c) => view.doors[c].open)
      .map((c) => `${CORNER_NAMES[c].toLowerCase()} door`),
    ...view.closures.filter((c) => c.open).map((c) => c.label.toLowerCase()),
  ]
  const lock =
    view.locked === null
      ? 'lock state unknown'
      : !view.locked
        ? 'not locked'
        : view.lockComplete
          ? 'locked'
          : 'locked, incomplete'
  const reported = Object.values(view.doors).every((d) => d.open !== null)
  const closed = reported ? 'everything closed' : 'closed where reported'
  return `${view.vehicle.model} diagram: ${lock}${open.length ? `, open: ${open.join(', ')}` : `, ${closed}`}`
}
