<script setup lang="ts">
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
</script>

<template>
  <q-page padding>
    <div class="analysis q-mx-auto">

      <!-- Page header -->
      <div class="page-header">
        <div class="page-badge">ANALYSIS</div>
        <h1 class="page-title">Terrain Analysis</h1>
        <p class="page-subtitle">View and manage your terrain analysis results.</p>
      </div>

      <!-- Empty state -->
      <div v-if="analysisStore.results.length === 0" class="empty-state">
        <div class="empty-icon-wrap">
          <q-icon name="public" size="48px" color="grey-8" />
        </div>
        <h3 class="empty-title">No analyses yet</h3>
        <p class="empty-desc">
          Navigate to the Map view to explore terrain and generate analysis data.
        </p>
        <q-btn
          to="/map"
          label="Open Map"
          color="amber"
          text-color="dark"
          unelevated
          no-caps
          icon="map"
          class="text-weight-bold cta-btn"
        />
      </div>

      <!-- Results list -->
      <div v-else class="results-list">
        <div
          v-for="result in analysisStore.results"
          :key="result.id"
          class="result-card"
        >
          <div class="result-icon">
            <q-icon name="terrain" size="20px" />
          </div>
          <div class="result-info">
            <div class="result-name">{{ result.name }}</div>
            <div class="result-meta">
              <span>
                <q-icon name="place" size="12px" />
                {{ result.location.lat.toFixed(4) }}, {{ result.location.lng.toFixed(4) }}
              </span>
              <span>
                <q-icon name="schedule" size="12px" />
                {{ new Date(result.timestamp).toLocaleDateString() }}
              </span>
            </div>
          </div>
          <q-icon name="chevron_right" size="20px" class="result-arrow" />
        </div>
      </div>

    </div>
  </q-page>
</template>

<style scoped>
.analysis {
  max-width: 800px;
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

/* ─── Empty State ─── */
.empty-state {
  text-align: center;
  padding: 60px 24px;
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 16px;
}

.empty-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(107, 124, 141, 0.08);
  border: 1px solid #1e2d3d;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.empty-title {
  font-size: 20px;
  font-weight: 700;
  color: #c8d6e5;
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 14px;
  color: #6b7c8d;
  max-width: 360px;
  margin: 0 auto 28px;
  line-height: 1.6;
}

.cta-btn {
  padding: 10px 28px;
  font-size: 14px;
  border-radius: 8px;
}

/* ─── Results List ─── */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #111a24;
  border: 1px solid #1e2d3d;
  border-radius: 12px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-card:hover {
  border-color: #2a3f55;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(232, 197, 71, 0.1);
  color: #e8c547;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.result-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7c8d;
}

.result-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-arrow {
  color: #3d4f5f;
  flex-shrink: 0;
  transition: all 0.2s;
}

.result-card:hover .result-arrow {
  color: #8899aa;
  transform: translateX(2px);
}
</style>
