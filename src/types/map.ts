export interface LatLng {
  lat: number
  lng: number
}

export type HuntLocationSource = 'manual' | 'map-center' | 'map-click'

export interface HuntLocation {
  label: string
  lat: number
  lng: number
  source: HuntLocationSource
  updatedAt: string
}

export interface MapViewState {
  center: LatLng
  zoom: number
}

export interface TileProvider {
  name: string
  url: string
  attribution: string
  maxZoom: number
}

export interface MapLayer {
  id: string
  name: string
  type: 'tile' | 'geojson' | 'overlay'
  visible: boolean
}
