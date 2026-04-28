/**
 * Minimal GPX waypoint parser. Targets onX-exported `.gpx` files but works
 * with any GPX 1.1 doc that has `<wpt lat lon>` elements. Doesn't try to
 * handle tracks or routes — only point waypoints.
 */

export interface GpxWaypoint {
  lat: number
  lng: number
  name: string
  /** onX category from `<onx:icon>` (Camp, Elk, Wallow, Point of Interest, …). Optional. */
  iconHint?: string
}

export function parseGpxWaypoints(xml: string): GpxWaypoint[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  const errors = doc.getElementsByTagName('parsererror')
  if (errors.length > 0) {
    throw new Error('Could not parse GPX — file is not valid XML')
  }

  const waypoints: GpxWaypoint[] = []
  // wpt elements live in the GPX namespace; querySelectorAll('wpt') works
  // because XML lookup is namespace-agnostic by tag name in DOMParser docs.
  const wpts = doc.getElementsByTagName('wpt')
  for (let i = 0; i < wpts.length; i++) {
    const w = wpts[i]
    const lat = parseFloat(w.getAttribute('lat') ?? '')
    const lng = parseFloat(w.getAttribute('lon') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const nameEl = w.getElementsByTagName('name')[0]
    const name = nameEl?.textContent?.trim() || `Waypoint ${i + 1}`

    // onX puts its category in <extensions><onx:icon>. Tag name as serialized
    // by the browser is "onx:icon" — getElementsByTagName matches the full
    // qualified name in HTML but in XML you can use either qname or wildcard.
    let iconHint: string | undefined
    const onxIcons = w.getElementsByTagName('onx:icon')
    if (onxIcons.length > 0 && onxIcons[0].textContent) {
      iconHint = onxIcons[0].textContent.trim()
    }

    waypoints.push({ lat, lng, name, iconHint })
  }

  return waypoints
}
