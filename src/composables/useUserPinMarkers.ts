import { watch, onUnmounted, type ShallowRef } from 'vue'
import L from 'leaflet'
import { useUserPinsStore } from '@/stores/userPins'
import { pinTypeMeta, type PinType } from '@/types/userPin'
import { userPinIconSvg } from '@/utils/userPinIcons'

/**
 * Renders manual user pins on the Leaflet map. Pins use a teardrop SVG
 * shape — visually distinct from the hex AI POI markers — with a per-type
 * accent color and centered Material icon.
 *
 * Click handler opens the edit popup. Drag-to-move is intentionally NOT
 * enabled; users can re-drop a pin if needed.
 */
export function useUserPinMarkers(map: ShallowRef<L.Map | null>) {
  const store = useUserPinsStore()
  const markersById = new Map<string, L.Marker>()
  const draftMarker: { current: L.Marker | null } = { current: null }

  function teardropHtml(type: PinType, isDraft: boolean): string {
    const meta = pinTypeMeta[type]
    const accent = meta.color
    const draftAttr = isDraft ? ' user-pin--draft' : ''
    const glyph = meta.iconKind
      ? userPinIconSvg(meta.iconKind, 'user-pin-icon user-pin-icon--svg', `color:${accent}`)
      : `<i class="material-icons user-pin-icon" style="color:${accent}">${meta.icon}</i>`
    return `
<div class="user-pin-wrap${draftAttr}">
  <svg class="user-pin-svg" width="32" height="42" viewBox="0 0 32 42">
    <!-- Teardrop body -->
    <path d="M16 1
             C 7 1, 1 8, 1 16
             C 1 25, 9 33, 16 41
             C 23 33, 31 25, 31 16
             C 31 8, 25 1, 16 1 Z"
          fill="#fefaf0"
          stroke="${accent}"
          stroke-width="2"/>
    <!-- Accent ring around the icon -->
    <circle cx="16" cy="16" r="10" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="1"/>
  </svg>
  ${glyph}
</div>`.trim()
  }

  function makeIcon(type: PinType, isDraft = false): L.DivIcon {
    return L.divIcon({
      className: 'user-pin-leaflet',
      html: teardropHtml(type, isDraft),
      iconSize: [32, 42],
      iconAnchor: [16, 41], // tip of the drop
    })
  }

  function clearMarkers() {
    for (const marker of markersById.values()) marker.remove()
    markersById.clear()
  }

  function clearDraftMarker() {
    if (draftMarker.current) {
      draftMarker.current.remove()
      draftMarker.current = null
    }
  }

  function rebuildMarkers(m: L.Map) {
    clearMarkers()
    for (const pin of store.pins) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: makeIcon(pin.type),
        riseOnHover: true,
      }).addTo(m)
      marker.on('click', (e) => {
        // Stop the click from bubbling to the map (which would otherwise be
        // interpreted as "drop a new pin here" when drop mode is active).
        L.DomEvent.stopPropagation(e)
        store.openDraftForExisting(pin)
      })
      markersById.set(pin.id, marker)
    }
  }

  function rebuildDraftMarker(m: L.Map) {
    clearDraftMarker()
    const d = store.draft
    if (!d || d.id) return // only show ephemeral marker for new (id===null) drafts
    draftMarker.current = L.marker([d.lat, d.lng], {
      icon: makeIcon(d.type, true),
      riseOnHover: true,
      interactive: false, // ignore clicks; popup owns the interaction
    }).addTo(m)
  }

  // Rebuild whenever the pin list changes (any field on any pin) or the map
  // becomes available. A deep watch on the array is the simplest correct
  // option — Pinia's setup-store ref auto-unwraps to the array.
  watch(
    [() => map.value, () => store.pins],
    ([m, pins]) => {
      console.log(`[userPins] markers watcher fired: map=${!!m} pins=${pins.length}`)
      if (m) rebuildMarkers(m)
    },
    { immediate: true, deep: true },
  )

  // Only rebuild the draft marker when its identity-changing fields change.
  // A deep watch on the whole draft would also fire on every keystroke in
  // the note field, causing a tear-down/re-add flicker that looks like the
  // pin is disappearing.
  watch(
    () => {
      const d = store.draft
      const m = map.value
      return [m, d?.id ?? '', d?.lat ?? 0, d?.lng ?? 0, d?.type ?? '', d ? 1 : 0] as const
    },
    () => {
      if (map.value) rebuildDraftMarker(map.value)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    clearMarkers()
    clearDraftMarker()
  })

  return { markersById }
}
