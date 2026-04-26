<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type L from 'leaflet'
import { useUserPinsStore } from '@/stores/userPins'
import { pinTypeMeta, pinTypeOrder, type PinType } from '@/types/userPin'

const props = defineProps<{ map: L.Map | null }>()

const store = useUserPinsStore()

const noteRef = ref<HTMLTextAreaElement | null>(null)
const screenPos = ref<{ x: number; y: number } | null>(null)

const isOpen = computed(() => store.draft !== null)
const isExisting = computed(() => !!store.draft?.id)

function recomputePosition() {
  if (!props.map || !store.draft) {
    screenPos.value = null
    return
  }
  const pt = props.map.latLngToContainerPoint([store.draft.lat, store.draft.lng])
  screenPos.value = { x: pt.x, y: pt.y }
}

watch(
  () => [props.map, store.draft],
  () => {
    recomputePosition()
    if (store.draft) {
      void nextTick(() => noteRef.value?.focus())
    }
  },
  { immediate: true, deep: true },
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
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    v-if="isOpen && screenPos"
    class="user-pin-popup"
    :style="{ left: `${screenPos.x}px`, top: `${screenPos.y}px` }"
    @click.stop
    @mousedown.stop
    @dblclick.stop
  >
    <div class="user-pin-popup__inner">
      <header class="upp-header">
        <span class="upp-header-label">{{ isExisting ? 'Edit pin' : 'New pin' }}</span>
        <button class="upp-close" type="button" :aria-label="'Close'" @click="cancel">
          <q-icon name="close" size="14px" />
        </button>
      </header>

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
          <i class="material-icons">{{ pinTypeMeta[t].icon }}</i>
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
.upp-type-btn .material-icons {
  font-size: 18px;
  color: var(--accent);
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
.upp-type-btn--active .material-icons { color: var(--accent); }

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
