<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { useRouter } from 'vue-router'
import FeedbackModal from '@/components/common/FeedbackModal.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const router = useRouter()
const feedbackOpen = ref(false)

const usageBadge = computed<{ short: string; tooltip: string } | null>(() => {
  if (!subscriptionStore.hasAccess) return null
  const limit = subscriptionStore.analysesLimit
  if (limit === Infinity) return null // Guide — don't bother showing a counter
  const used = subscriptionStore.analysesUsed
  const remaining = Math.max(0, limit - used)
  return {
    short: `${remaining} / ${limit} left`,
    tooltip: `${used} of ${limit} monthly analyses used. Resets on the 1st (UTC).`,
  }
})

const trialBadge = computed<{ short: string; tooltip: string } | null>(() => {
  if (!subscriptionStore.isOnTrial) return null
  const days = subscriptionStore.trialDaysLeft
  const end = subscriptionStore.trialEndDate
  if (days == null || !end) return null

  const short =
    days <= 0 ? 'Trial ends today'
    : days === 1 ? '1 day left'
    : `${days} days left`

  const endStr = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const tooltip = `Free trial — billing begins ${endStr}`

  return { short, tooltip }
})

// const navItems = [
//   { name: 'Dashboard', path: '/app', icon: 'dashboard' },
//   { name: 'Map', path: '/map', icon: 'map' },
//   { name: 'Analysis', path: '/analysis', icon: 'analytics' },
//   { name: 'Settings', path: '/settings', icon: 'settings' },
// ]

async function handleSignOut() {
  await authStore.signOut()
  router.push('/')
}
</script>

<template>
  <q-header class="app-header">
    <q-toolbar class="toolbar q-px-md">
      <q-btn
        flat
        dense
        round
        icon="menu"
        color="grey-5"
        class="menu-btn"
        @click="appStore.toggleSidebar"
      />

      <q-toolbar-title class="logo" shrink>
        <span class="logo-text">Ridge</span><span class="logo-accent">Read</span>
        <span class="logo-badge q-ml-sm">ELK TERRAIN INTELLIGENCE</span>
      </q-toolbar-title>

      <q-space />

      <!-- <nav class="nav-links">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item--active': route.path === item.path }"
        >
          <q-icon :name="item.icon" size="18px" />
          <span class="nav-label">{{ item.name }}</span>
        </router-link>
      </nav> -->

      <!-- Trial badge -->
      <div
        v-if="trialBadge"
        class="trial-badge"
        :title="trialBadge.tooltip"
        :aria-label="trialBadge.tooltip"
      >
        <q-icon name="schedule" size="13px" />
        <span class="trial-badge-text">Trial: {{ trialBadge.short }}</span>
      </div>

      <!-- Usage badge (Pro only — Guide is unlimited) -->
      <div
        v-if="usageBadge"
        class="usage-badge q-ml-sm"
        :class="{ 'usage-badge--low': subscriptionStore.analysesRemaining <= 3 }"
        :title="usageBadge.tooltip"
        :aria-label="usageBadge.tooltip"
      >
        <q-icon name="bolt" size="13px" />
        <span class="usage-badge-text">{{ usageBadge.short }}</span>
      </div>

      <!-- User menu -->
      <div v-if="authStore.isAuthenticated" class="q-ml-md">
        <q-btn flat round dense class="user-btn">
          <q-avatar size="34px" class="user-avatar">
            <img v-if="authStore.photoURL" :src="authStore.photoURL" referrerpolicy="no-referrer" />
            <q-icon v-else name="person" color="grey-5" />
          </q-avatar>
          <q-menu class="user-menu" anchor="bottom right" self="top right">
            <q-list style="min-width: 220px">
              <q-item class="q-py-md">
                <q-item-section avatar>
                  <q-avatar size="40px">
                    <img v-if="authStore.photoURL" :src="authStore.photoURL" referrerpolicy="no-referrer" />
                    <q-icon v-else name="person" size="24px" />
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold text-white">{{ authStore.displayName }}</q-item-label>
                  <q-item-label caption class="text-grey-6">{{ authStore.email }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator color="grey-9" />
              <q-item clickable v-close-popup class="feedback-item" @click="feedbackOpen = true">
                <q-item-section avatar>
                  <q-icon name="lightbulb" color="amber-5" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="feedback-label">Feedback or Idea</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator color="grey-9" />
              <q-item clickable v-close-popup @click="handleSignOut" class="signout-item">
                <q-item-section avatar>
                  <q-icon name="logout" color="red-4" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-red-4">Sign Out</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </q-toolbar>
  </q-header>

  <FeedbackModal v-model="feedbackOpen" />
</template>

<style scoped>
.app-header {
  background: linear-gradient(180deg, #0a0e14 0%, #0c1119 100%) !important;
  border-bottom: 1px solid #1e2d3d;
}

.toolbar {
  min-height: 56px;
}

.menu-btn {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.menu-btn:hover {
  opacity: 1;
}

/* ─── Logo ─── */
.logo {
  font-size: 19px;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 0;
}

.logo-text {
  color: #fff;
  font-weight: 800;
}

.logo-accent {
  color: #e8c547;
  font-weight: 800;
}

.logo-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #e8c547;
  background: rgba(232, 197, 71, 0.08);
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid rgba(232, 197, 71, 0.15);
}

/* ─── Navigation ─── */
.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7c8d;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.nav-item:hover {
  color: #c8d6e5;
  background: rgba(200, 214, 229, 0.06);
}

.nav-item--active {
  color: #e8c547 !important;
  background: rgba(232, 197, 71, 0.1);
  border: 1px solid rgba(232, 197, 71, 0.15);
}

/* ─── Trial badge ─── */
.trial-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #e8c547;
  background: rgba(232, 197, 71, 0.1);
  border: 1px solid rgba(232, 197, 71, 0.25);
  border-radius: 12px;
  cursor: default;
  white-space: nowrap;
}

.trial-badge-text {
  line-height: 1;
}

@media (max-width: 599px) {
  .trial-badge-text,
  .usage-badge-text {
    display: none;
  }
  .trial-badge,
  .usage-badge {
    padding: 5px 7px;
  }
}

/* ─── Usage badge ─── */
.usage-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #8aaedb;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 12px;
  cursor: default;
  white-space: nowrap;
}

.usage-badge--low {
  color: #ff8a8a;
  background: rgba(213, 78, 78, 0.12);
  border-color: rgba(213, 78, 78, 0.3);
}

.usage-badge-text {
  line-height: 1;
}

/* ─── User ─── */
.user-avatar {
  border: 2px solid #1e2d3d;
  transition: border-color 0.2s;
}

.user-btn:hover .user-avatar {
  border-color: rgba(232, 197, 71, 0.3);
}

.user-menu {
  background: #111a24 !important;
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  overflow: hidden;
}

.signout-item:hover {
  background: rgba(244, 67, 54, 0.08);
}

.feedback-label {
  color: #c8d6e5;
}

.feedback-item:hover {
  background: rgba(232, 197, 71, 0.08);
}

/* ─── Mobile ─── */
@media (max-width: 599px) {
  .logo-badge {
    display: none;
  }
  .nav-label {
    display: none;
  }
  .nav-item {
    padding: 6px 10px;
  }
}
</style>
