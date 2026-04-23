import type { LatLng } from './map'
import type { Season } from '@/data/elkBehavior'
import type { PointOfInterest } from '@/data/pointsOfInterest'

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

export interface AnalysisBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface SavedAnalysis {
  id: string
  userId: string
  bounds: AnalysisBounds
  season: Season
  bufferMiles: number
  combos: Record<string, PointOfInterest[]>
  createdAt: number
}
