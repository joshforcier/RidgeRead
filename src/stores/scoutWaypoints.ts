import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  collection,
  doc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuthStore } from './auth'
import { parseGpxWaypoints, type GpxWaypoint } from '@/utils/parseGpx'
import { synthesizeScoutPoi } from '@/utils/synthesizePoi'
import type { PointOfInterest } from '@/data/pointsOfInterest'

/**
 * Inspection data we expect back from /api/inspect-points. Mirror of
 * PointInspection on the server — kept structural to avoid a shared types
 * package.
 */
export interface InspectionData {
  point: { lat: number; lng: number; elevation: number; elevationFt: number; slope: number; aspect: string }
  neighbors: Record<'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW', number>
  features: Record<'saddle' | 'ridge' | 'drainage' | 'bench' | 'fingerRidge', { detected: boolean; reason: string }>
}

export interface ScoutWaypoint {
  id: string
  lat: number
  lng: number
  name: string
  iconHint?: string
  inspection: InspectionData
  importedAt: number
}

/**
 * Stable doc ID derived from coords — re-importing the same waypoint
 * upserts the existing doc instead of creating a duplicate.
 * 5 decimals ≈ 1.1m precision, plenty for waypoint dedup.
 */
function stableIdFor(lat: number, lng: number): string {
  return `scout_${lat.toFixed(5)}_${lng.toFixed(5)}`.replace(/[.-]/g, (c) => (c === '.' ? '_' : 'n'))
}

export const useScoutWaypointsStore = defineStore('scoutWaypoints', () => {
  const waypoints = ref<ScoutWaypoint[]>([])
  const loading = ref(true)
  const importing = ref(false)
  const importError = ref<string | null>(null)
  const importProgress = ref<{ done: number; total: number } | null>(null)

  let unsub: Unsubscribe | null = null
  let activeUid: string | null = null

  const auth = useAuthStore()

  function colRef(uid: string) {
    return collection(db, 'customers', uid, 'scoutWaypoints')
  }

  function subscribe(uid: string) {
    if (activeUid === uid && unsub) return
    unsubscribeFn()
    activeUid = uid
    loading.value = true
    const q = query(colRef(uid), orderBy('importedAt', 'desc'))
    unsub = onSnapshot(
      q,
      (snap) => {
        waypoints.value = snap.docs.map((d) => {
          const data = d.data() as Omit<ScoutWaypoint, 'id'>
          return { id: d.id, ...data }
        })
        loading.value = false
      },
      (err) => {
        console.error('[scoutWaypoints] onSnapshot error:', err)
        loading.value = false
      },
    )
  }

  function unsubscribeFn() {
    if (unsub) {
      unsub()
      unsub = null
    }
    activeUid = null
    waypoints.value = []
    loading.value = true
  }

  watch(
    () => auth.user?.uid ?? null,
    (uid) => {
      if (uid) subscribe(uid)
      else unsubscribeFn()
    },
    { immediate: true },
  )

  /**
   * Parse a GPX file, run inspections on every waypoint, and upsert each
   * to Firestore. Same-coords waypoints overwrite their previous doc
   * (stable ID derived from lat/lng to 5 decimals).
   */
  async function importGpx(file: File): Promise<{ count: number }> {
    if (!auth.user?.uid) {
      importError.value = 'Sign in to import waypoints'
      throw new Error('not signed in')
    }
    importing.value = true
    importError.value = null
    importProgress.value = null
    try {
      const text = await file.text()
      const parsed: GpxWaypoint[] = parseGpxWaypoints(text)
      if (parsed.length === 0) {
        throw new Error('No waypoints found in this GPX file')
      }

      importProgress.value = { done: 0, total: parsed.length }

      const idToken = await auth.user.getIdToken().catch(() => null)
      if (!idToken) throw new Error('Could not get auth token')

      const res = await fetch('/api/inspect-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          points: parsed.map((w) => ({ lat: w.lat, lng: w.lng })),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Batch inspection failed (${res.status})`)
      }
      const body = (await res.json()) as {
        results: Array<{ lat: number; lng: number; inspection?: InspectionData; error?: string }>
      }

      // Persist via Firestore batch write — atomic + far cheaper than
      // N independent setDoc calls when the GPX has many waypoints.
      const uid = auth.user.uid
      const batches: ReturnType<typeof writeBatch>[] = []
      const BATCH_LIMIT = 450 // Firestore caps at 500 writes per batch
      let current = writeBatch(db)
      let n = 0
      const now = Date.now()
      let imported = 0

      for (let i = 0; i < parsed.length; i++) {
        const wp = parsed[i]
        const result = body.results[i]
        if (!result?.inspection) continue
        const id = stableIdFor(wp.lat, wp.lng)
        const docRef = doc(colRef(uid), id)
        current.set(docRef, {
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          iconHint: wp.iconHint ?? null,
          inspection: result.inspection,
          importedAt: now,
        })
        n++
        imported++
        importProgress.value = { done: i + 1, total: parsed.length }
        if (n >= BATCH_LIMIT) {
          batches.push(current)
          current = writeBatch(db)
          n = 0
        }
      }
      if (n > 0) batches.push(current)
      for (const b of batches) await b.commit()

      return { count: imported }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      importError.value = msg
      throw err
    } finally {
      importing.value = false
      importProgress.value = null
    }
  }

  async function clearAll(): Promise<void> {
    if (!auth.user?.uid) return
    if (!confirm(`Delete all ${waypoints.value.length} imported waypoints? This cannot be undone.`)) {
      return
    }
    const uid = auth.user.uid
    const all = [...waypoints.value]
    // Delete in batches the same way we wrote them.
    const BATCH_LIMIT = 450
    let current = writeBatch(db)
    let n = 0
    const batches: ReturnType<typeof writeBatch>[] = []
    for (const wp of all) {
      current.delete(doc(colRef(uid), wp.id))
      n++
      if (n >= BATCH_LIMIT) {
        batches.push(current)
        current = writeBatch(db)
        n = 0
      }
    }
    if (n > 0) batches.push(current)
    for (const b of batches) await b.commit()
  }

  async function deleteOne(id: string): Promise<void> {
    if (!auth.user?.uid) return
    await deleteDoc(doc(colRef(auth.user.uid), id))
  }

  /**
   * Synthesized POIs for the existing render path. Each waypoint's
   * inspection becomes a POI with derived behaviors so usePOIMarkers
   * and PoiDetailPanel render them like AI-placed POIs.
   */
  const synthesizedPois = computed<PointOfInterest[]>(() =>
    waypoints.value.map((wp) =>
      synthesizeScoutPoi({
        id: wp.id,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        iconHint: wp.iconHint,
        inspection: wp.inspection,
      }),
    ),
  )

  return {
    waypoints,
    loading,
    importing,
    importError,
    importProgress,
    synthesizedPois,
    importGpx,
    clearAll,
    deleteOne,
  }
})
