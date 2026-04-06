// ─── Top & Bottom Part Identifiers ───────────────────────────────────────────

export const TOP_PART_IDS = {
  STAR: 'star',
  TRIANGLE: 'triangle',
  ROUND: 'round',
  QUADRATIC: 'quadratic',
  CUSHIONED: 'cushioned'
} as const

export type TopPartId = (typeof TOP_PART_IDS)[keyof typeof TOP_PART_IDS]

export const BOTTOM_PART_IDS = {
  SPEEDY: 'speedy',
  TANKY: 'tanky',
  BALANCED: 'balanced'
} as const

export type BottomPartId = (typeof BOTTOM_PART_IDS)[keyof typeof BOTTOM_PART_IDS]

// ─── Part Interfaces ─────────────────────────────────────────────────────────

export interface TopPart {
  id: TopPartId
  label: string
  damageMultiplier: number
  defenseMultiplier: number
  healthBonus: number
  shape: 'star' | 'triangle' | 'circle' | 'square' | 'cushion'
}

export interface BottomPart {
  id: BottomPartId
  label: string
  speedMultiplier: number
  forceDecay: number
  healthBonus: number
  weight: number
}

// ─── Bayblade Composition ────────────────────────────────────────────────────

export interface BaybladeConfig {
  topPartId: TopPartId
  bottomPartId: BottomPartId
  topLevel?: number
  bottomLevel?: number
  modelId?: string
}

export interface BaybladeStats {
  maxHp: number
  totalWeight: number
  damageMultiplier: number
  defenseMultiplier: number
  speedMultiplier: number
  forceDecay: number
  top: TopPart
  bottom: BottomPart
}

// ─── Runtime Bayblade State ──────────────────────────────────────────────────

export interface BaybladeState {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  // Acceleration ramp — blade builds speed over ACCEL_FRAMES after launch
  ax: number
  ay: number
  accelFramesLeft: number
  radius: number
  hp: number
  maxHp: number
  rotation: number
  rotationSpeed: number
  hitFlash: number
  wallBounceCount: number
  config: BaybladeConfig
  owner: 'player' | 'npc'
}

// ─── Meteor Shower Particle ──────────────────────────────────────────────────

export interface MeteorParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
}

// ─── Spritesheet Animation ──────────────────────────────────────────────────

export interface SpritesheetAnimation {
  x: number
  y: number
  frame: number
  timer: number
  frameDuration: number
  totalFrames: number
  frameWidth: number
  frameHeight: number
  scale: number
  vertical: boolean
  image: HTMLImageElement
}

// ─── Game Phase State Machine ────────────────────────────────────────────────

export type GamePhase =
  | 'idle'
  | 'tap_to_start'
  | 'meteor_intro'
  | 'deciding_turn'
  | 'player_turn'
  | 'player_launched'
  | 'npc_turn'
  | 'npc_launched'
  | 'game_over'

export type GameResult = 'win' | 'lose' | null
