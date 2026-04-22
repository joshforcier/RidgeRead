<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { useMapStore } from '@/stores/map'
import { ref } from 'vue'

const appStore = useAppStore()
const mapStore = useMapStore()

const tileUrl = ref('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
const defaultZoom = ref(mapStore.zoom)
</script>

<template>
  <q-page padding>
    <div class="settings q-mx-auto">

      <!-- Page header -->
      <div class="page-header">
        <div class="page-badge">SETTINGS</div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Configure your RidgeRead preferences.</p>
      </div>

      <!-- Appearance -->
      <div class="settings-section">
        <div class="section-header">
          <q-icon name="palette" size="18px" class="section-icon" />
          <span>Appearance</span>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">Dark Mode</span>
            <span class="setting-desc">Toggle dark theme for the app interface</span>
          </div>
          <q-toggle
            :model-value="appStore.darkMode"
            @update:model-value="appStore.toggleDarkMode()"
            color="amber"
          />
        </div>
        <div class="setting-divider" />
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">Show Sidebar</span>
            <span class="setting-desc">Toggle the sidebar control panel visibility</span>
          </div>
          <q-toggle
            :model-value="appStore.sidebarOpen"
            @update:model-value="appStore.toggleSidebar()"
            color="amber"
          />
        </div>
      </div>

      <!-- Map -->
      <div class="settings-section">
        <div class="section-header">
          <q-icon name="map" size="18px" class="section-icon" />
          <span>Map</span>
        </div>
        <div class="setting-block">
          <label class="input-label">Tile Provider URL</label>
          <q-input
            v-model="tileUrl"
            dark
            filled
            dense
            class="tile-input"
            input-class="text-mono"
          />
        </div>
        <div class="setting-divider" />
        <div class="setting-block">
          <div class="zoom-header">
            <label class="input-label">Default Zoom Level</label>
            <span class="zoom-value">{{ defaultZoom }}</span>
          </div>
          <q-slider
            v-model="defaultZoom"
            :min="1"
            :max="18"
            :step="1"
            color="amber"
            track-color="grey-9"
            dark
          />
          <div class="zoom-range">
            <span>1</span>
            <span>18</span>
          </div>
        </div>
      </div>

    </div>
  </q-page>
</template>

<style scoped>
.settings {
  max-width: 640px;
}

/* ─── Page Header ─── */
.page-header {
  margin-bottom: 36px;
  text-align: center;
}

.page-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
  color: #e8c547;
  background: rgba(232, 197, 71, 0.08);
  padding: 4px 14px;
  border-radius: 16px;
  border: 1px solid rgba(232, 197, 71, 0.15);
  margin-bottom: 16px;
}

.page-title {
  font-size: clamp(24px, 3.5vw, 32px);
  font-weight: 800;
  color: #fff;
  margin: 0 0 8px;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 15px;
  color: #6b7c8d;
  margin: 0;
}

/* ─── Settings Sections ─── */
.settings-section {
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: rgba(30, 45, 61, 0.3);
  border-bottom: 1px solid #1e2d3d;
}

.section-icon {
  color: #e8c547;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 14px;
  font-weight: 600;
  color: #c8d6e5;
}

.setting-desc {
  font-size: 12px;
  color: #4a5e70;
}

.setting-divider {
  height: 1px;
  background: #1e2d3d;
  margin: 0 20px;
}

.setting-block {
  padding: 16px 20px;
}

.input-label {
  font-size: 12px;
  font-weight: 600;
  color: #8899aa;
  display: block;
  margin-bottom: 8px;
}

.tile-input :deep(.q-field__control) {
  background: #0a0e14;
  border: 1px solid #1e2d3d;
  border-radius: 8px;
}

.text-mono {
  font-family: monospace;
  font-size: 12px;
}

.zoom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.zoom-value {
  font-size: 20px;
  font-weight: 800;
  color: #e8c547;
  font-variant-numeric: tabular-nums;
}

.zoom-range {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #4a5e70;
  font-weight: 500;
  margin-top: 4px;
}
</style>
