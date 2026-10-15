// Leaflet maps on Esri Gray Canvas basemaps, which serve without an API key (CARTO now requires
// one). The tile domain is allowed in the resource CSP (src/apps.ts).

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { h, onTeardown } from './dom.ts'

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const ATTRIBUTION = 'Esri, HERE, Garmin, © OpenStreetMap contributors'
/** The canvas layers have tiles up to this zoom; Leaflet scales them beyond it. */
const NATIVE_ZOOM = 16

export interface Route {
  points: [number, number][]
  onClick?: () => void
  tooltip?: string
}

export interface MapOptions {
  dark: boolean
  routes: Route[]
  /** Mark the start and end of the first route. */
  endpoints?: boolean
  /** One position to mark, such as where the vehicle is parked. */
  pin?: [number, number]
  height?: number
}

/** Returns the map element. Leaflet initializes once the element is in the document. */
export function routeMap(opts: MapOptions): HTMLElement {
  const el = h('div', { class: 'map', style: `height:${opts.height ?? 340}px` })
  const routes = opts.routes.filter((r) => r.points.length > 0)
  if (routes.length === 0 && !opts.pin) {
    el.append(h('p', { class: 'empty' }, 'No route recorded.'))
    return el
  }
  let disposed = false
  let dispose = () => {}
  onTeardown(() => {
    disposed = true
    dispose()
  })
  requestAnimationFrame(() => {
    if (disposed) return
    const map = L.map(el, { scrollWheelZoom: false, attributionControl: false })
    L.control.attribution({ prefix: false }).addAttribution(ATTRIBUTION).addTo(map)
    const shade = opts.dark ? 'Dark' : 'Light'
    for (const layer of ['Base', 'Reference']) {
      L.tileLayer(`${TILES}/World_${shade}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`, {
        maxNativeZoom: NATIVE_ZOOM,
        maxZoom: 18,
      }).addTo(map)
    }

    const many = routes.length > 1
    const lines = routes.map((route) => {
      // A darker casing under the green line keeps it readable on both basemaps.
      L.polyline(route.points, { className: 'route-casing', weight: many ? 4 : 7 }).addTo(map)
      const line = L.polyline(route.points, { className: 'route', weight: many ? 2.5 : 4.5 }).addTo(
        map,
      )
      if (route.tooltip) line.bindTooltip(route.tooltip, { sticky: true })
      if (route.onClick) line.on('click', route.onClick)
      return line
    })
    if (opts.endpoints) {
      const pts = routes[0].points
      marker(pts[0], 'start', 'Start').addTo(map)
      marker(pts[pts.length - 1], 'end', 'End').addTo(map)
    }
    if (opts.pin) marker(opts.pin, 'here', 'Vehicle').addTo(map)
    if (lines.length) {
      map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [24, 24], maxZoom: 16 })
    } else if (opts.pin) {
      map.setView(opts.pin, 14)
    }
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el)
    dispose = () => {
      observer.disconnect()
      map.remove()
    }
  })
  return el
}

function marker(at: [number, number], kind: 'start' | 'end' | 'here', label: string): L.Marker {
  return L.marker(at, {
    title: label,
    icon: L.divIcon({ className: `pin pin-${kind}`, iconSize: [18, 18], iconAnchor: [9, 9] }),
  })
}
