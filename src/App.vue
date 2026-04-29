<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { Analytics } from '@vercel/analytics/vue'

const route = useRoute()

// Landing page renders bare (no header/sidebar). App pages use DefaultLayout.
const hideChrome = computed(() => route.meta.hideChrome === true)
</script>

<template>
  <!-- Landing page: full-page, no app shell -->
  <RouterView v-if="hideChrome" />

  <!-- App pages: header + sidebar + content -->
  <DefaultLayout v-else />
  <Analytics />
</template>

<style>
body {
  background: #0a0e14;
  margin: 0;
}
</style>
