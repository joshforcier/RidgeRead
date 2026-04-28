<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type L from 'leaflet'
import { useUserPinsStore } from '@/stores/userPins'
import { pinTypeMeta, pinTypeOrder, type PinType } from '@/types/userPin'
import CoordinateChip from '@/components/common/CoordinateChip.vue'

const props = defineProps<{ map: L.Map | null }>()

const store = useUserPinsStore()

const noteRef = ref<HTMLTextAreaElement | null>(null)
const screenPos = ref<{ x: number; y: number } | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)

let dragStart: { pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null = null

const isOpen = computed(() => store.draft !== null)
const isExisting = computed(() => !!store.draft?.id)
const customIconKinds = new Set(['elk-antlers', 'binoculars', 'tracks'])

const popupStyle = computed(() => {
  if (!screenPos.value) return {}
  return {
    left: `${screenPos.value.x + dragOffset.value.x}px`,
    top: `${screenPos.value.y + dragOffset.value.y}px`,
  }
})

function isCustomIcon(type: PinType): boolean {
  return customIconKinds.has(pinTypeMeta[type].iconKind ?? '')
}

function recomputePosition() {
  if (!props.map || !store.draft) {
    screenPos.value = null
    return
  }
  const pt = props.map.latLngToContainerPoint([store.draft.lat, store.draft.lng])
  screenPos.value = { x: pt.x, y: pt.y }
}

watch(
  () => {
    const d = store.draft
    return [props.map, d?.id ?? 'new', d?.lat ?? 0, d?.lng ?? 0, d ? 1 : 0] as const
  },
  () => {
    dragOffset.value = { x: 0, y: 0 }
    recomputePosition()
    if (store.draft) {
      void nextTick(() => noteRef.value?.focus())
    }
  },
  { immediate: true },
)

// Keep popup pinned to the pin during pan/zoom.
function attachMapListeners(m: L.Map) {
  m.on('move', recomputePosition)
  m.on('zoom', recomputePosition)
  m.on('resize', recomputePosition)
}
function detachMapListeners(m: L.Map) {
  m.off('move', recomputePosition)
  m.off('zoom', recomputePosition)
  m.off('resize', recomputePosition)
}

watch(
  () => props.map,
  (m, old) => {
    if (old) detachMapListeners(old)
    if (m) attachMapListeners(m)
  },
  { immediate: true },
)

function pickType(type: PinType) {
  store.updateDraft({ type })
}

function onNoteInput(e: Event) {
  store.updateDraft({ note: (e.target as HTMLTextAreaElement).value })
}

async function save() {
  await store.saveDraft()
}

async function remove() {
  if (!confirm('Delete this pin?')) return
  await store.deleteDraft()
}

function cancel() {
  store.clearSaveError()
  store.closeDraft()
}

function onHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return

  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
  dragStart = {
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    offsetX: dragOffset.value.x,
    offsetY: dragOffset.value.y,
  }
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
}

function onWindowPointerMove(e: PointerEvent) {
  if (!dragStart || e.pointerId !== dragStart.pointerId) return
  dragOffset.value = {
    x: dragStart.offsetX + e.clientX - dragStart.x,
    y: dragStart.offsetY + e.clientY - dragStart.y,
  }
}

function onWindowPointerUp(e: PointerEvent) {
  if (dragStart && e.pointerId !== dragStart.pointerId) return
  isDragging.value = false
  dragStart = null
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
}

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    void save()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
})
</script>

<template>
  <div
    v-if="isOpen && screenPos"
    class="user-pin-popup"
    :class="{ 'user-pin-popup--dragging': isDragging }"
    :style="popupStyle"
    @click.stop
    @mousedown.stop
    @pointerdown.stop
    @dblclick.stop
  >
    <div class="user-pin-popup__inner">
      <header class="upp-header" @pointerdown="onHeaderPointerDown">
        <span class="upp-header-label">{{ isExisting ? 'Edit pin' : 'New pin' }}</span>
        <button class="upp-close" type="button" :aria-label="'Close'" @pointerdown.stop @click="cancel">
          <q-icon name="close" size="14px" />
        </button>
      </header>

      <div v-if="store.draft" class="upp-coord-row">
        <CoordinateChip :lat="store.draft.lat" :lng="store.draft.lng" />
      </div>

      <div class="upp-section-label">Type</div>
      <div class="upp-type-grid">
        <button
          v-for="t in pinTypeOrder"
          :key="t"
          class="upp-type-btn"
          :class="{ 'upp-type-btn--active': store.draft?.type === t }"
          :style="{ '--accent': pinTypeMeta[t].color } as never"
          type="button"
          @click="pickType(t)"
        >
          <i
            v-if="!isCustomIcon(t)"
            class="material-icons upp-type-icon"
          >{{ pinTypeMeta[t].icon }}</i>
          <svg
            v-else-if="pinTypeMeta[t].iconKind === 'elk-antlers'"
            class="upp-type-icon upp-type-icon--svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 20v-6" />
            <path d="M12 14c-2.6-1.2-4.5-3.8-5.2-6.8" />
            <path d="M6.8 7.2 4.6 5" />
            <path d="M7.4 9.7H4.2" />
            <path d="M8.8 12.2 6.2 14.3" />
            <path d="M12 14c2.6-1.2 4.5-3.8 5.2-6.8" />
            <path d="M17.2 7.2 19.4 5" />
            <path d="M16.6 9.7h3.2" />
            <path d="M15.2 12.2l2.6 2.1" />
            <path d="M10 20h4" />
          </svg>
          <svg
            v-else-if="pinTypeMeta[t].iconKind === 'binoculars'"
            class="upp-type-icon upp-type-icon--svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M7.5 8.5 9 5.5h2l1 3" />
            <path d="M16.5 8.5 15 5.5h-2l-1 3" />
            <path d="M5.5 9.5h5v7h-5z" />
            <path d="M13.5 9.5h5v7h-5z" />
            <path d="M10.5 12h3" />
            <path d="M6.8 16.5c0 1.1.9 2 2 2s2-.9 2-2" />
            <path d="M13.2 16.5c0 1.1.9 2 2 2s2-.9 2-2" />
          </svg>
          <svg
            v-else
            class="upp-type-icon upp-type-icon--svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8.3 5.8c1.2 1.2 1.5 3.2.6 4.4-.9 1.2-2.7 1.1-4-.1-1.2-1.2-1.5-3.2-.6-4.4.9-1.2 2.7-1.1 4 .1Z" />
            <path d="M15.7 13.8c1.2 1.2 1.5 3.2.6 4.4-.9 1.2-2.7 1.1-4-.1-1.2-1.2-1.5-3.2-.6-4.4.9-1.2 2.7-1.1 4 .1Z" />
            <path d="M11.5 4.5c.8.3 1.2 1.2.9 2" />
            <path d="M4.2 13.4c.8.3 1.2 1.2.9 2" />
            <path d="M18.9 9c.8.3 1.2 1.2.9 2" />
          </svg>
          <span>{{ pinTypeMeta[t].label }}</span>
        </button>
      </div>

      <div class="upp-section-label">Note</div>
      <textarea
        ref="noteRef"
        class="upp-note"
        rows="3"
        placeholder="Add a note (optional)…"
        :value="store.draft?.note ?? ''"
        @input="onNoteInput"
      />

      <p v-if="store.saveError" class="upp-error">{{ store.saveError }}</p>

      <footer class="upp-footer">
        <button v-if="isExisting" class="upp-btn upp-btn--danger" type="button" @click="remove">
          Delete
        </button>
        <span class="upp-spacer" />
        <button class="upp-btn upp-btn--ghost" type="button" @click="cancel">Cancel</button>
        <button class="upp-btn upp-btn--primary" type="button" @click="save">
          {{ isExisting ? 'Save' : 'Add' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.user-pin-popup {
  position: absolute;
  /* Anchor: tip of the pin is at (latLng) screen coords. The pin's tip is the
     iconAnchor we set in the marker (16, 41), so the popup needs to sit a
     bit above the tip. We translate so the popup is centered horizontally and
     positioned above the pin top (the pin is 42px tall). */
  transform: translate(-50%, calc(-100% - 50px));
  z-index: 1100;
  pointer-events: auto;
}

.user-pin-popup--dragging {
  cursor: grabbing;
}

.user-pin-popup__inner {
  width: 280px;
  background: rgba(15, 25, 35, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 12px;
  color: #e8edf2;
  font-size: 13px;
  user-select: none;
}

.upp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  cursor: grab;
  touch-action: none;
}

.user-pin-popup--dragging .upp-header {
  cursor: grabbing;
}

.upp-header-label {
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 11px;
  color: #a8b8c8;
}

.upp-close {
  background: transparent;
  border: none;
  color: #a8b8c8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: inline-flex;
}
.upp-close:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }

.upp-coord-row {
  display: flex;
  margin-bottom: 6px;
}

.upp-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7d8a99;
  margin: 6px 0 6px;
}

.upp-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.upp-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  color: #c8d2dd;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.upp-type-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.upp-type-icon {
  font-size: 18px;
  color: var(--accent);
}
.upp-type-icon--svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.upp-type-btn span {
  font-size: 10px;
  letter-spacing: 0.02em;
}
.upp-type-btn--active {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: var(--accent);
  color: #fff;
}
.upp-type-btn--active .upp-type-icon { color: var(--accent); }

.upp-note {
  width: 100%;
  resize: vertical;
  min-height: 60px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #1e2d3d;
  border-radius: 8px;
  color: #e8edf2;
  font-family: inherit;
  font-size: 12px;
  padding: 8px 10px;
  outline: none;
}
.upp-note:focus { border-color: #4a90e2; }

.upp-error {
  font-size: 12px;
  color: #ff8a8a;
  background: rgba(213, 78, 78, 0.12);
  border: 1px solid rgba(213, 78, 78, 0.35);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 12px 0 0;
  line-height: 1.4;
}

.upp-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}

.upp-spacer { flex: 1; }

.upp-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
}

.upp-btn--ghost {
  background: transparent;
  color: #a8b8c8;
  border-color: #2c3e54;
}
.upp-btn--ghost:hover { color: #fff; border-color: #4a90e2; }

.upp-btn--primary {
  background: #4a90e2;
  color: #fff;
}
.upp-btn--primary:hover { background: #3b7cc4; }

.upp-btn--danger {
  background: transparent;
  color: #d57878;
  border-color: rgba(213, 120, 120, 0.5);
}
.upp-btn--danger:hover {
  background: rgba(213, 120, 120, 0.12);
  color: #fff;
}
</style>
