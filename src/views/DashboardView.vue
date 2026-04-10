<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useMapStore } from '@/stores/map'
import { seasonLabels, timeLabels } from '@/data/elkBehavior'

const router = useRouter()
const mapStore = useMapStore()

const actionCards = [
  {
    icon: 'map',
    title: 'Open Terrain Map',
    desc: 'View the heatmap overlay, POI markers, and behavior scores across the terrain grid.',
    path: '/map',
    primary: true,
  },
  {
    icon: 'analytics',
    title: 'Analysis Results',
    desc: 'Review terrain analysis data and zone breakdowns.',
    path: '/analysis',
    primary: false,
  },
  {
    icon: 'settings',
    title: 'Settings',
    desc: 'Configure tile providers, map defaults, and display preferences.',
    path: '/settings',
    primary: false,
  },
]
</script>

<template>
  <q-page padding>
    <div class="dashboard q-mx-auto">

      <!-- Page header -->
      <div class="page-header">
        <div class="page-badge">DASHBOARD</div>
        <h1 class="page-title">TerrainIQ Dashboard</h1>
        <p class="page-subtitle">Elk terrain intelligence and behavior analysis platform.</p>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ seasonLabels[mapStore.season] }}</div>
          <div class="stat-label">Season Phase</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ timeLabels[mapStore.timeOfDay] }}</div>
          <div class="stat-label">Time of Day</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ mapStore.activeBehaviors.length }}</div>
          <div class="stat-label">Active Layers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ (mapStore.intensity * 100).toFixed(0) }}%</div>
          <div class="stat-label">Heatmap Intensity</div>
        </div>
      </div>

      <!-- Get Started -->
      <div class="section-heading">
        <q-icon name="rocket_launch" size="20px" color="amber" />
        <span>Get Started</span>
      </div>

      <div class="action-grid">
        <div
          v-for="card in actionCards"
          :key="card.path"
          class="action-card"
          :class="{ 'action-card--primary': card.primary }"
          @click="router.push(card.path)"
        >
          <div class="action-icon-wrap" :class="{ 'action-icon-wrap--primary': card.primary }">
            <q-icon :name="card.icon" size="24px" />
          </div>
          <h3 class="action-title">{{ card.title }}</h3>
          <p class="action-desc">{{ card.desc }}</p>
          <div class="action-arrow">
            <q-icon name="arrow_forward" size="16px" />
          </div>
        </div>
      </div>

    </div>
  </q-page>
</template>

<style scoped>
.dashboard {
  max-width: 960px;
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

/* ─── Stat Cards ─── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
  transition: border-color 0.2s;
}

.stat-card:hover {
  border-color: rgba(232, 197, 71, 0.2);
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: #e8c547;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6b7c8d;
}

/* ─── Section Heading ─── */
.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 16px;
}

/* ─── Action Cards ─── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.action-card {
  position: relative;
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  padding: 28px 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  border-color: #2a3f55;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.action-card--primary {
  border-color: rgba(232, 197, 71, 0.25);
}

.action-card--primary:hover {
  border-color: rgba(232, 197, 71, 0.5);
  box-shadow: 0 8px 24px rgba(232, 197, 71, 0.06);
}

.action-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(107, 124, 141, 0.1);
  color: #6b7c8d;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.action-icon-wrap--primary {
  background: rgba(232, 197, 71, 0.1);
  color: #e8c547;
  border: 1px solid rgba(232, 197, 71, 0.15);
}

.action-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
}

.action-desc {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7c8d;
  margin: 0;
}

.action-arrow {
  position: absolute;
  top: 24px;
  right: 20px;
  color: #3d4f5f;
  transition: all 0.2s;
}

.action-card:hover .action-arrow {
  color: #8899aa;
  transform: translateX(3px);
}

.action-card--primary:hover .action-arrow {
  color: #e8c547;
}

/* ─── Mobile ─── */
@media (max-width: 599px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
