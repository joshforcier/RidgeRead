import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { PinType, UserPin } from '@/types/userPin'

/**
 * Draft pin state used while the popup is open. For new (not-yet-saved) pins
 * `id` is null; for editing existing pins it's the Firestore doc id.
 */
export interface PinDraft {
  id: string | null
  lat: number
  lng: number
  type: PinType
  note: string
}

export const useUserPinsStore = defineStore('userPins', () => {
  const pins = ref<UserPin[]>([])
  const dropMode = ref(false)
  const draft = ref<PinDraft | null>(null)
  const saveError = ref<string | null>(null)

  let unsub: Unsubscribe | null = null
  let activeUid: string | null = null

  function pinsCollection(uid: string) {
    return collection(db, 'users', uid, 'pins')
  }

  /**
   * Subscribe to the signed-in user's pins. Idempotent — calling with the same
   * uid is a no-op; calling with a different uid swaps subscriptions cleanly.
   */
  function subscribe(uid: string) {
    if (activeUid === uid && unsub) return
    unsubscribe()
    activeUid = uid
    const q = query(pinsCollection(uid), orderBy('createdAt', 'desc'))
    console.log(`[userPins] subscribing to users/${uid}/pins`)
    unsub = onSnapshot(
      q,
      (snap) => {
        pins.value = snap.docs.map((d) => {
          const data = d.data() as Omit<UserPin, 'id'>
          return { id: d.id, ...data }
        })
        console.log(`[userPins] snapshot: ${pins.value.length} pin(s)`)
      },
      (err) => {
        console.error('[userPins] onSnapshot error:', err)
      },
    )
  }

  function unsubscribe() {
    if (unsub) {
      unsub()
      unsub = null
    }
    activeUid = null
    pins.value = []
  }

  async function createPin(input: {
    lat: number
    lng: number
    type: PinType
    note: string
  }): Promise<string | null> {
    if (!activeUid) {
      console.warn('createPin called without an active user')
      return null
    }
    const ref = await addDoc(pinsCollection(activeUid), {
      lat: input.lat,
      lng: input.lng,
      type: input.type,
      note: input.note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // serverTimestamp is preferred for ordering but Date.now() is fine
      // here since we sort client-side after the snapshot lands.
      _serverCreatedAt: serverTimestamp(),
    })
    console.log(`[userPins] createPin succeeded, doc id: ${ref.id}`)
    return ref.id
  }

  async function updatePin(id: string, patch: Partial<Pick<UserPin, 'type' | 'note' | 'lat' | 'lng'>>) {
    if (!activeUid) return
    await updateDoc(doc(db, 'users', activeUid, 'pins', id), {
      ...patch,
      updatedAt: Date.now(),
    })
  }

  async function removePin(id: string) {
    if (!activeUid) return
    await deleteDoc(doc(db, 'users', activeUid, 'pins', id))
  }

  function enterDropMode() {
    dropMode.value = true
  }

  function exitDropMode() {
    dropMode.value = false
  }

  function toggleDropMode() {
    dropMode.value = !dropMode.value
  }

  function openDraftForNew(lat: number, lng: number, type: PinType = 'note') {
    draft.value = { id: null, lat, lng, type, note: '' }
  }

  function openDraftForExisting(pin: UserPin) {
    draft.value = { id: pin.id, lat: pin.lat, lng: pin.lng, type: pin.type, note: pin.note }
  }

  function updateDraft(patch: Partial<PinDraft>) {
    if (!draft.value) return
    draft.value = { ...draft.value, ...patch }
  }

  function closeDraft() {
    draft.value = null
  }

  async function saveDraft(): Promise<void> {
    const d = draft.value
    if (!d) return
    saveError.value = null
    try {
      if (d.id) {
        await updatePin(d.id, { type: d.type, note: d.note })
      } else {
        await createPin({ lat: d.lat, lng: d.lng, type: d.type, note: d.note })
      }
      draft.value = null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Failed to save pin:', err)
      if (msg.toLowerCase().includes('permission')) {
        saveError.value =
          'Permission denied. Add a Firestore rule for users/{uid}/pins (see project README).'
      } else {
        saveError.value = `Failed to save pin: ${msg}`
      }
    }
  }

  async function deleteDraft(): Promise<void> {
    const d = draft.value
    if (!d || !d.id) return
    saveError.value = null
    try {
      await removePin(d.id)
      draft.value = null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Failed to delete pin:', err)
      saveError.value = `Failed to delete pin: ${msg}`
    }
  }

  function clearSaveError() {
    saveError.value = null
  }

  return {
    pins,
    dropMode,
    draft,
    saveError,
    subscribe,
    unsubscribe,
    createPin,
    updatePin,
    removePin,
    enterDropMode,
    exitDropMode,
    toggleDropMode,
    openDraftForNew,
    openDraftForExisting,
    updateDraft,
    closeDraft,
    saveDraft,
    deleteDraft,
    clearSaveError,
  }
})
