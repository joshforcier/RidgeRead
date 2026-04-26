<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const sub = useSubscriptionStore()

const selected = ref<'pro' | 'guide'>('pro')

function close() {
  if (sub.checkoutLoading) return
  emit('update:modelValue', false)
  sub.clearCheckoutError()
}

async function startTrial() {
  await sub.startCheckout(sub.plans[selected.value])
  // If startCheckout succeeds it redirects away; if it fails, the error
  // is set on the store and shown inline.
}

function onKeydown(e: KeyboardEvent) {
  if (props.modelValue && e.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Auto-close once the user actually has access (e.g. webhook landed during
// the modal session).
watch(
  () => sub.hasAccess,
  (has) => {
    if (has && props.modelValue) emit('update:modelValue', false)
  },
)
</script>

<template>
  <transition name="modal-fade">
    <div v-if="modelValue" class="sub-modal-backdrop" @click.self="close">
      <div class="sub-modal">
        <button class="sub-modal-close" type="button" @click="close" :aria-label="'Close'">
          <q-icon name="close" size="18px" />
        </button>

        <div class="sub-modal-eyebrow">30-DAY FREE TRIAL</div>
        <h2 class="sub-modal-title">Start Your Free Trial</h2>
        <p class="sub-modal-sub">
          Unlock terrain analysis, AI-placed POIs, all behavior layers, and offline maps.
          Your card is held but not charged for 30 days. Cancel anytime.
        </p>

        <div class="plan-options">
          <button
            v-for="plan in [sub.plans.pro, sub.plans.guide]"
            :key="plan.id"
            type="button"
            class="plan-option"
            :class="{ 'plan-option--selected': selected === plan.id }"
            @click="selected = plan.id"
          >
            <div class="plan-option-radio">
              <span v-if="selected === plan.id" class="plan-option-dot" />
            </div>
            <div class="plan-option-body">
              <div class="plan-option-row">
                <span class="plan-option-name">{{ plan.label }}</span>
                <span class="plan-option-price">${{ plan.monthly }}<span class="plan-option-per">/mo</span></span>
              </div>
              <div class="plan-option-detail">
                {{ plan.id === 'pro' ? '20 analyses per month' : 'Unlimited analyses' }}
                · 30-day free trial
              </div>
            </div>
          </button>
        </div>

        <p v-if="sub.checkoutError" class="sub-modal-error">{{ sub.checkoutError }}</p>

        <button
          class="sub-modal-cta"
          type="button"
          :disabled="sub.checkoutLoading"
          @click="startTrial"
        >
          <q-spinner v-if="sub.checkoutLoading" size="18px" />
          <span v-else>Start 30-Day Free Trial</span>
        </button>

        <p class="sub-modal-fineprint">
          Card required. You won't be charged until your trial ends.
          Cancel anytime in settings.
        </p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.sub-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(5, 8, 12, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.sub-modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 14px;
  padding: 32px 28px 24px;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.5);
  color: #c8d6e5;
}

.sub-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #6b7c8d;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: inline-flex;
}
.sub-modal-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.sub-modal-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #e8c547;
  background: rgba(232, 197, 71, 0.1);
  border: 1px solid rgba(232, 197, 71, 0.25);
  padding: 4px 10px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.sub-modal-title {
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 10px;
  letter-spacing: -0.5px;
}

.sub-modal-sub {
  font-size: 14px;
  line-height: 1.6;
  color: #8899aa;
  margin: 0 0 22px;
}

.plan-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.plan-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #1e2d3d;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: border-color 0.12s, background 0.12s;
}
.plan-option:hover {
  border-color: #2c4055;
  background: rgba(255, 255, 255, 0.04);
}
.plan-option--selected {
  border-color: #e8c547;
  background: rgba(232, 197, 71, 0.06);
}

.plan-option-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #4a5868;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.plan-option--selected .plan-option-radio {
  border-color: #e8c547;
}

.plan-option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e8c547;
}

.plan-option-body {
  flex: 1;
  min-width: 0;
}

.plan-option-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.plan-option-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.plan-option-price {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}

.plan-option-per {
  font-size: 12px;
  font-weight: 500;
  color: #6b7c8d;
}

.plan-option-detail {
  font-size: 12px;
  color: #7a8d9c;
  margin-top: 2px;
}

.sub-modal-error {
  font-size: 12px;
  color: #ff8a8a;
  background: rgba(213, 78, 78, 0.12);
  border: 1px solid rgba(213, 78, 78, 0.35);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 0 0 12px;
  line-height: 1.4;
}

.sub-modal-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0a0e14;
  background: #e8c547;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s, transform 0.08s;
}
.sub-modal-cta:hover:not(:disabled) {
  background: #f0d260;
}
.sub-modal-cta:active:not(:disabled) {
  transform: translateY(1px);
}
.sub-modal-cta:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.sub-modal-fineprint {
  font-size: 11px;
  color: #6b7c8d;
  text-align: center;
  margin: 12px 0 0;
  line-height: 1.5;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
