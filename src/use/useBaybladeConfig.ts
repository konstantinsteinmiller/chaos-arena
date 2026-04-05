import { ref } from 'vue'
import type { Ref } from 'vue'
import type {
  TopPartId,
  BottomPartId,
  TopPart,
  BottomPart,
  BaybladeConfig,
  BaybladeStats
} from '@/types/bayblade'

// ─── Part Definitions ────────────────────────────────────────────────────────

export const TOP_PARTS: Record<TopPartId, TopPart> = {
  star: {
    id: 'star',
    label: 'Star Blade',
    damageMultiplier: 1.8,
    defenseMultiplier: 0.8,
    healthBonus: 0,
    shape: 'star'
  },
  triangle: {
    id: 'triangle',
    label: 'Tri Edge',
    damageMultiplier: 1.4,
    defenseMultiplier: 0.9,
    healthBonus: 50,
    shape: 'triangle'
  },
  round: {
    id: 'round',
    label: 'Round Guard',
    damageMultiplier: 0.8,
    defenseMultiplier: 1.5,
    healthBonus: 150,
    shape: 'circle'
  },
  quadratic: {
    id: 'quadratic',
    label: 'Quad Core',
    damageMultiplier: 1.0,
    defenseMultiplier: 1.0,
    healthBonus: 100,
    shape: 'square'
  },
  cushioned: {
    id: 'cushioned',
    label: 'Soft Shell',
    damageMultiplier: 0.6,
    defenseMultiplier: 1.8,
    healthBonus: 200,
    shape: 'cushion'
  }
}

export const BOTTOM_PARTS: Record<BottomPartId, BottomPart> = {
  speedy: {
    id: 'speedy',
    label: 'Speedy',
    speedMultiplier: 1.5,
    forceDecay: 0.9985,
    healthBonus: 0,
    weight: 80
  },
  tanky: {
    id: 'tanky',
    label: 'Tanky',
    speedMultiplier: 0.7,
    forceDecay: 0.994,
    healthBonus: 200,
    weight: 150
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    speedMultiplier: 1.0,
    forceDecay: 0.996,
    healthBonus: 100,
    weight: 110
  }
}

export const TOP_PARTS_LIST = Object.values(TOP_PARTS)
export const BOTTOM_PARTS_LIST = Object.values(BOTTOM_PARTS)

// ─── Stats Computation ───────────────────────────────────────────────────────

const BASE_HP = 500

export const computeStats = (config: BaybladeConfig): BaybladeStats => {
  const top = TOP_PARTS[config.topPartId]
  const bottom = BOTTOM_PARTS[config.bottomPartId]

  return {
    maxHp: BASE_HP + top.healthBonus + bottom.healthBonus,
    totalWeight: bottom.weight,
    damageMultiplier: top.damageMultiplier,
    defenseMultiplier: top.defenseMultiplier,
    speedMultiplier: bottom.speedMultiplier,
    forceDecay: bottom.forceDecay,
    top,
    bottom
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const TEAM_KEY = 'bayblade_player_team'
const COINS_KEY = 'bayblade_coins'

const DEFAULT_TEAM: BaybladeConfig[] = [
  { topPartId: 'star', bottomPartId: 'balanced' },
  { topPartId: 'round', bottomPartId: 'balanced' }
]

const loadStoredTeam = (): BaybladeConfig[] => {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed
    }
  } catch { /* fall through */
  }
  return DEFAULT_TEAM.map(c => ({ ...c }))
}

const loadStoredCoins = (): number => {
  try {
    const raw = localStorage.getItem(COINS_KEY)
    if (raw) return parseInt(raw, 10) || 0
  } catch { /* fall through */
  }
  return 0
}

// ─── Module-Level Singleton State ────────────────────────────────────────────

const playerTeam: Ref<BaybladeConfig[]> = ref(loadStoredTeam())
const coins: Ref<number> = ref(loadStoredCoins())

// ─── Public API ──────────────────────────────────────────────────────────────

const saveTeam = (team: BaybladeConfig[]) => {
  playerTeam.value = team.map(c => ({ ...c }))
  localStorage.setItem(TEAM_KEY, JSON.stringify(team))
}

const addCoins = (amount: number) => {
  coins.value += amount
  localStorage.setItem(COINS_KEY, coins.value.toString())
}

const useBaybladeConfig = () => ({
  playerTeam,
  coins,
  saveTeam,
  addCoins
})

export default useBaybladeConfig
