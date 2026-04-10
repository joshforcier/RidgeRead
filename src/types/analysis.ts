import type { LatLng } from './map'

export interface AnalysisResult {
  id: string
  name: string
  timestamp: number
  location: LatLng
  data: Record<string, unknown>
}

export interface TerrainData {
  elevation: number
  slope: number
  aspect: number
}
