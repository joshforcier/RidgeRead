/**
 * User-placed pins — manually dropped markers, separate from AI POIs.
 * Persisted in Firestore at users/{uid}/pins/{pinId}.
 */

export type PinType =
  | 'elk'
  | 'glassing'
  | 'stand'
  | 'camp'
  | 'trail-cam'
  | 'sign'
  | 'kill-site'
  | 'access'
  | 'note'

export interface UserPin {
  id: string
  lat: number
  lng: number
  type: PinType
  note: string
  createdAt: number // ms epoch
  updatedAt: number
}

export interface PinTypeMeta {
  label: string
  icon: string // Material Icons ligature name, or a custom icon id
  iconKind?: 'material' | 'elk-antlers' | 'binoculars' | 'tracks'
  color: string // hex accent color
}

/**
 * Display metadata per pin type. Colors are intentionally distinct from the
 * elk-behavior palette in elkBehavior.ts so user pins read as user-owned, not
 * AI-generated.
 */
export const pinTypeMeta: Record<PinType, PinTypeMeta> = {
  elk:         { label: 'Elk',         icon: 'elk_antlers',    iconKind: 'elk-antlers', color: '#d4a017' },
  glassing:    { label: 'Glassing',    icon: 'binoculars',     iconKind: 'binoculars', color: '#4a90e2' },
  stand:       { label: 'Stand',       icon: 'park',           color: '#7b5e3c' },
  camp:        { label: 'Camp',        icon: 'cottage',        color: '#c46a3f' },
  'trail-cam': { label: 'Trail Cam',   icon: 'photo_camera',   color: '#9c6ade' },
  sign:        { label: 'Sign',        icon: 'tracks',         iconKind: 'tracks', color: '#5a8f5a' },
  'kill-site': { label: 'Kill Site',   icon: 'flag',           color: '#c94f4f' },
  access:      { label: 'Access',      icon: 'local_parking',  color: '#7a8a99' },
  note:        { label: 'Note',        icon: 'sticky_note_2',  color: '#e6c84a' },
}

export const pinTypeOrder: PinType[] = [
  'elk',
  'glassing',
  'stand',
  'sign',
  'kill-site',
  'trail-cam',
  'camp',
  'access',
  'note',
]
