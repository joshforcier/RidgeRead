<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useRoute } from 'vue-router'
import { db } from '@/config/firebase'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const auth = useAuthStore()
const route = useRoute()

const kind = ref<'idea' | 'feedback' | 'bug'>('idea')
const title = ref('')
const message = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const submitted = ref(false)

const canSubmit = computed(() => {
  return title.value.trim().length >= 3 && message.value.trim().length >= 10 && !submitting.value
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    submitError.value = null
    submitted.value = false
  },
)

function close() {
  if (submitting.value) return
  emit('update:modelValue', false)
}

function resetForm() {
  kind.value = 'idea'
  title.value = ''
  message.value = ''
  submitError.value = null
  submitted.value = false
}

async function submitFeedback() {
  if (!auth.user?.uid || !canSubmit.value) return

  submitting.value = true
  submitError.value = null
  try {
    await addDoc(collection(db, 'customers', auth.user.uid, 'feedback'), {
      kind: kind.value,
      title: title.value.trim(),
      message: message.value.trim(),
      route: route.fullPath,
      userAgent: navigator.userAgent,
      email: auth.email,
      displayName: auth.displayName,
      status: 'new',
      createdAt: serverTimestamp(),
    })
    submitted.value = true
    title.value = ''
    message.value = ''
  } catch (err: unknown) {
    console.error('[feedback] submit failed:', err)
    submitError.value = err instanceof Error ? err.message : 'Could not send feedback'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <transition name="feedback-fade">
    <div v-if="modelValue" class="feedback-backdrop" @click.self="close">
      <section class="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button class="feedback-close" type="button" :aria-label="'Close'" @click="close">
          <q-icon name="close" size="18px" />
        </button>

        <div class="feedback-eyebrow">FIELD NOTES</div>
        <h2 id="feedback-title" class="feedback-title">Send feedback or an idea</h2>
        <p class="feedback-sub">
          Tell me what would make RidgeRead more useful in the field. Ideas, rough edges,
          confusing labels, and feature requests all help shape the next pass.
        </p>

        <div v-if="submitted" class="feedback-success">
          <q-icon name="check_circle" size="18px" />
          <div>
            <strong>Sent.</strong>
            <span>Thanks for the field intel.</span>
          </div>
        </div>

        <form class="feedback-form" @submit.prevent="submitFeedback">
          <div class="feedback-kind-row" role="radiogroup" aria-label="Feedback type">
            <button
              v-for="option in [
                { value: 'idea', label: 'Idea', icon: 'lightbulb' },
                { value: 'feedback', label: 'Feedback', icon: 'forum' },
                { value: 'bug', label: 'Bug', icon: 'bug_report' },
              ]"
              :key="option.value"
              type="button"
              class="feedback-kind"
              :class="{ 'feedback-kind--active': kind === option.value }"
              :aria-pressed="kind === option.value"
              @click="kind = option.value as typeof kind"
            >
              <q-icon :name="option.icon" size="15px" />
              <span>{{ option.label }}</span>
            </button>
          </div>

          <label class="feedback-label">
            <span>Short title</span>
            <input
              v-model="title"
              class="feedback-input"
              type="text"
              maxlength="90"
              placeholder="Example: Show wind direction on POIs"
              autocomplete="off"
            />
          </label>

          <label class="feedback-label">
            <span>Details</span>
            <textarea
              v-model="message"
              class="feedback-textarea"
              rows="6"
              maxlength="1600"
              placeholder="What happened, what you expected, or what would make scouting easier?"
            />
          </label>

          <div class="feedback-meta">
            <span>{{ message.length }} / 1600</span>
            <span>{{ route.fullPath }}</span>
          </div>

          <p v-if="submitError" class="feedback-error">{{ submitError }}</p>

          <div class="feedback-actions">
            <button class="feedback-secondary" type="button" :disabled="submitting" @click="resetForm">
              Clear
            </button>
            <button class="feedback-primary" type="submit" :disabled="!canSubmit">
              <q-spinner v-if="submitting" size="16px" />
              <span v-else>Send</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.feedback-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 8, 12, 0.72);
  backdrop-filter: blur(7px);
}

.feedback-modal {
  position: relative;
  width: min(520px, 100%);
  color: #c8d6e5;
  background:
    linear-gradient(135deg, rgba(232, 197, 71, 0.08), transparent 35%),
    #101822;
  border: 1px solid #243344;
  border-radius: 14px;
  padding: 30px 28px 24px;
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.52);
}

.feedback-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  padding: 6px;
  color: #6b7c8d;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.feedback-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.feedback-eyebrow {
  display: inline-flex;
  padding: 4px 10px;
  margin-bottom: 14px;
  color: #e8c547;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.4px;
  background: rgba(232, 197, 71, 0.09);
  border: 1px solid rgba(232, 197, 71, 0.22);
  border-radius: 999px;
}

.feedback-title {
  margin: 0 28px 8px 0;
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0;
}

.feedback-sub {
  margin: 0 0 20px;
  color: #8999a8;
  font-size: 14px;
  line-height: 1.55;
}

.feedback-success {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  margin-bottom: 14px;
  color: #96d9aa;
  background: rgba(70, 180, 110, 0.1);
  border: 1px solid rgba(70, 180, 110, 0.26);
  border-radius: 10px;
}

.feedback-success div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.feedback-form,
.feedback-label {
  display: flex;
  flex-direction: column;
}

.feedback-form {
  gap: 12px;
}

.feedback-kind-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.feedback-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  color: #8796a5;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #213144;
  border-radius: 8px;
  cursor: pointer;
}

.feedback-kind:hover {
  color: #c8d6e5;
  border-color: #31445b;
}

.feedback-kind--active {
  color: #0a0e14;
  background: #e8c547;
  border-color: #e8c547;
}

.feedback-label {
  gap: 6px;
  color: #a7b5c2;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.feedback-input,
.feedback-textarea {
  width: 100%;
  color: #e6edf5;
  font: inherit;
  font-size: 13px;
  background: rgba(5, 8, 12, 0.42);
  border: 1px solid #253548;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.12s, background 0.12s;
}

.feedback-input {
  height: 40px;
  padding: 0 12px;
}

.feedback-textarea {
  min-height: 132px;
  padding: 11px 12px;
  resize: vertical;
  line-height: 1.45;
}

.feedback-input:focus,
.feedback-textarea:focus {
  background: rgba(5, 8, 12, 0.58);
  border-color: rgba(232, 197, 71, 0.6);
}

.feedback-input::placeholder,
.feedback-textarea::placeholder {
  color: #586675;
}

.feedback-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #657585;
  font-size: 11px;
}

.feedback-meta span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-error {
  padding: 8px 10px;
  margin: 0;
  color: #ff8a8a;
  font-size: 12px;
  background: rgba(213, 78, 78, 0.12);
  border: 1px solid rgba(213, 78, 78, 0.32);
  border-radius: 8px;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.feedback-primary,
.feedback-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92px;
  min-height: 38px;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  border-radius: 8px;
  cursor: pointer;
}

.feedback-primary {
  color: #0a0e14;
  background: #e8c547;
  border: 1px solid #e8c547;
}

.feedback-primary:hover:not(:disabled) {
  background: #f0d260;
}

.feedback-secondary {
  color: #9aabba;
  background: transparent;
  border: 1px solid #2a3a4d;
}

.feedback-secondary:hover:not(:disabled) {
  color: #fff;
  border-color: #40566e;
}

.feedback-primary:disabled,
.feedback-secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.feedback-fade-enter-active,
.feedback-fade-leave-active {
  transition: opacity 0.16s ease;
}

.feedback-fade-enter-from,
.feedback-fade-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .feedback-backdrop {
    align-items: flex-end;
    padding: 12px;
  }

  .feedback-modal {
    padding: 28px 18px 18px;
  }

  .feedback-kind-row {
    grid-template-columns: 1fr;
  }
}
</style>