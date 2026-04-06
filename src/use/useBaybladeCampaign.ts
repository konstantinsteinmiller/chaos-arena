import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { TopPartId, BottomPartId } from '@/types/bayblade'

// ─── Stage Enemy Config ─────────────────────────────────────────────────────

export interface StageBladeConfig {
  topPartId: TopPartId
  bottomPartId: BottomPartId
  topLevel: number
  bottomLevel: number
  modelId?: string
}

export interface Stage {
  id: number
  name: string
  enemyTeam: StageBladeConfig[]
  rewardWin: number
  rewardLose: number
}

// ─── Manually Editable Stage Definitions ────────────────────────────────────

export const STAGES: Stage[] = [
  // ── Early Game (1-5): low stats, forgiving ────────────────────────────────
  {
    id: 1, name: 'Rookie Arena',
    enemyTeam: [
      { topPartId: 'cushioned', bottomPartId: 'balanced', topLevel: 0, bottomLevel: 0, modelId: 'shell' },
      { topPartId: 'round', bottomPartId: 'balanced', topLevel: 0, bottomLevel: 0, modelId: 'turtle' }
    ],
    rewardWin: 80, rewardLose: 30
  },
  {
    id: 2, name: 'Training Grounds',
    enemyTeam: [
      { topPartId: 'quadratic', bottomPartId: 'balanced', topLevel: 0, bottomLevel: 0, modelId: 'mysticaleye' },
      { topPartId: 'triangle', bottomPartId: 'balanced', topLevel: 0, bottomLevel: 0, modelId: 'bluedragon' }
    ],
    rewardWin: 90, rewardLose: 30
  },
  {
    id: 3, name: 'Iron League',
    enemyTeam: [
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 1, bottomLevel: 0, modelId: 'eagle' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 0, bottomLevel: 1, modelId: 'castle' }
    ],
    rewardWin: 100, rewardLose: 35
  },
  {
    id: 4, name: 'Steel Circuit',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'balanced', topLevel: 1, bottomLevel: 0, modelId: 'phoenix' },
      { topPartId: 'quadratic', bottomPartId: 'speedy', topLevel: 1, bottomLevel: 1, modelId: 'chip' },
      { topPartId: 'cushioned', bottomPartId: 'balanced', topLevel: 0, bottomLevel: 0, modelId: 'nature' }
    ],
    rewardWin: 110, rewardLose: 35
  },
  {
    id: 5, name: 'Gold Division',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 1, bottomLevel: 1, modelId: 'fire' },
      { topPartId: 'triangle', bottomPartId: 'tanky', topLevel: 1, bottomLevel: 1, modelId: 'thunder' },
      { topPartId: 'round', bottomPartId: 'balanced', topLevel: 1, bottomLevel: 0, modelId: 'ice' },
      { topPartId: 'cushioned', bottomPartId: 'speedy', topLevel: 0, bottomLevel: 1, modelId: 'wulf' }
    ],
    rewardWin: 130, rewardLose: 40
  },

  // ── Mid Game (6-10): enemies start upgrading ──────────────────────────────
  {
    id: 6, name: 'Platinum Ring',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 2, bottomLevel: 1, modelId: 'scorpion' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 1, bottomLevel: 2, modelId: 'prisma' }
    ],
    rewardWin: 140, rewardLose: 45
  },
  {
    id: 7, name: 'Diamond Arena',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 2, bottomLevel: 2, modelId: 'thunderstorm' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 2, bottomLevel: 1, modelId: 'snake' },
      { topPartId: 'quadratic', bottomPartId: 'balanced', topLevel: 1, bottomLevel: 1, modelId: 'mysticaleye' }
    ],
    rewardWin: 160, rewardLose: 50
  },
  {
    id: 8, name: 'Champion\'s Gate',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'balanced', topLevel: 3, bottomLevel: 2, modelId: 'fire' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 2, bottomLevel: 3, modelId: 'castle' }
    ],
    rewardWin: 180, rewardLose: 55
  },
  {
    id: 9, name: 'Legend\'s Trial',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 3, bottomLevel: 3, modelId: 'phoenix' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 3, bottomLevel: 3, modelId: 'chip' },
      { topPartId: 'triangle', bottomPartId: 'balanced', topLevel: 2, bottomLevel: 2, modelId: 'eagle' }
    ],
    rewardWin: 200, rewardLose: 60
  },
  {
    id: 10, name: 'Warlord\'s Keep',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 4, bottomLevel: 3, modelId: 'scorpion' },
      { topPartId: 'star', bottomPartId: 'tanky', topLevel: 3, bottomLevel: 4, modelId: 'thunderstorm' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 3, bottomLevel: 2, modelId: 'snake' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 2, bottomLevel: 3, modelId: 'prisma' }
    ],
    rewardWin: 250, rewardLose: 70
  },

  // ── Late Game (11-15): tougher combos ─────────────────────────────────────
  {
    id: 11, name: 'Shadow Pit',
    enemyTeam: [
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 3, bottomLevel: 3, modelId: 'bluedragon' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 3, bottomLevel: 3, modelId: 'shell' }
    ],
    rewardWin: 200, rewardLose: 65
  },
  {
    id: 12, name: 'Crimson Forge',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 4, bottomLevel: 3, modelId: 'fire' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 3, bottomLevel: 4, modelId: 'turtle' },
      { topPartId: 'quadratic', bottomPartId: 'balanced', topLevel: 3, bottomLevel: 3, modelId: 'mysticaleye' }
    ],
    rewardWin: 220, rewardLose: 70
  },
  {
    id: 13, name: 'Frost Cavern',
    enemyTeam: [
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 4, bottomLevel: 4, modelId: 'ice' },
      { topPartId: 'cushioned', bottomPartId: 'balanced', topLevel: 3, bottomLevel: 3, modelId: 'nature' }
    ],
    rewardWin: 210, rewardLose: 65
  },
  {
    id: 14, name: 'Thunder Peaks',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 4, bottomLevel: 4, modelId: 'thunder' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 4, bottomLevel: 3, modelId: 'eagle' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 3, bottomLevel: 3, modelId: 'chip' }
    ],
    rewardWin: 230, rewardLose: 70
  },
  {
    id: 15, name: 'Serpent\'s Nest',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 5, bottomLevel: 4, modelId: 'snake' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 4, bottomLevel: 4, modelId: 'scorpion' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 4, bottomLevel: 4, modelId: 'prisma' },
      { topPartId: 'cushioned', bottomPartId: 'balanced', topLevel: 3, bottomLevel: 3, modelId: 'wulf' }
    ],
    rewardWin: 280, rewardLose: 80
  },

  // ── End Game (16-20): high upgrades ───────────────────────────────────────
  {
    id: 16, name: 'Obsidian Colosseum',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 5, bottomLevel: 4, modelId: 'phoenix' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 4, bottomLevel: 5, modelId: 'castle' }
    ],
    rewardWin: 240, rewardLose: 75
  },
  {
    id: 17, name: 'Volcanic Rift',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 5, bottomLevel: 5, modelId: 'fire' },
      { topPartId: 'triangle', bottomPartId: 'balanced', topLevel: 5, bottomLevel: 4, modelId: 'thunderstorm' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 4, bottomLevel: 5, modelId: 'shell' }
    ],
    rewardWin: 260, rewardLose: 80
  },
  {
    id: 18, name: 'Crystal Spire',
    enemyTeam: [
      { topPartId: 'quadratic', bottomPartId: 'balanced', topLevel: 5, bottomLevel: 5, modelId: 'prisma' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 5, bottomLevel: 5, modelId: 'nature' }
    ],
    rewardWin: 250, rewardLose: 75
  },
  {
    id: 19, name: 'Storm Citadel',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 6, bottomLevel: 5, modelId: 'thunder' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 5, bottomLevel: 5, modelId: 'bluedragon' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 5, bottomLevel: 5, modelId: 'mysticaleye' }
    ],
    rewardWin: 280, rewardLose: 85
  },
  {
    id: 20, name: 'Dragon\'s Throne',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 6, bottomLevel: 6, modelId: 'scorpion' },
      { topPartId: 'star', bottomPartId: 'tanky', topLevel: 5, bottomLevel: 6, modelId: 'fire' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 6, bottomLevel: 5, modelId: 'snake' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 5, bottomLevel: 6, modelId: 'castle' }
    ],
    rewardWin: 350, rewardLose: 100
  },

  // ── Master Tier (21-25): punishing encounters ─────────────────────────────
  {
    id: 21, name: 'Phantom Depths',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 6, bottomLevel: 6, modelId: 'thunderstorm' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 6, bottomLevel: 6, modelId: 'turtle' }
    ],
    rewardWin: 300, rewardLose: 90
  },
  {
    id: 22, name: 'Abyssal Arena',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 7, bottomLevel: 6, modelId: 'phoenix' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 6, bottomLevel: 6, modelId: 'eagle' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 6, bottomLevel: 7, modelId: 'ice' }
    ],
    rewardWin: 320, rewardLose: 95
  },
  {
    id: 23, name: 'Void Nexus',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'balanced', topLevel: 7, bottomLevel: 7, modelId: 'chip' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 7, bottomLevel: 7, modelId: 'prisma' }
    ],
    rewardWin: 310, rewardLose: 90
  },
  {
    id: 24, name: 'Titan\'s Gauntlet',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 7, bottomLevel: 7, modelId: 'fire' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 7, bottomLevel: 6, modelId: 'snake' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 6, bottomLevel: 7, modelId: 'wulf' }
    ],
    rewardWin: 340, rewardLose: 100
  },
  {
    id: 25, name: 'Apocalypse Ring',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 8, bottomLevel: 7, modelId: 'scorpion' },
      { topPartId: 'star', bottomPartId: 'tanky', topLevel: 7, bottomLevel: 8, modelId: 'thunderstorm' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 7, bottomLevel: 7, modelId: 'bluedragon' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 7, bottomLevel: 7, modelId: 'castle' }
    ],
    rewardWin: 400, rewardLose: 110
  },

  // ── Legendary Tier (26-30): ultimate challenges ───────────────────────────
  {
    id: 26, name: 'Celestial Forge',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 8, bottomLevel: 8, modelId: 'phoenix' },
      { topPartId: 'quadratic', bottomPartId: 'tanky', topLevel: 8, bottomLevel: 8, modelId: 'mysticaleye' }
    ],
    rewardWin: 350, rewardLose: 100
  },
  {
    id: 27, name: 'Infernal Summit',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 8, bottomLevel: 8, modelId: 'fire' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 8, bottomLevel: 8, modelId: 'thunder' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 8, bottomLevel: 8, modelId: 'nature' }
    ],
    rewardWin: 380, rewardLose: 110
  },
  {
    id: 28, name: 'Eternal Vortex',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 9, bottomLevel: 8, modelId: 'snake' },
      { topPartId: 'round', bottomPartId: 'tanky', topLevel: 8, bottomLevel: 9, modelId: 'shell' }
    ],
    rewardWin: 370, rewardLose: 105
  },
  {
    id: 29, name: 'Omega Trials',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 9, bottomLevel: 9, modelId: 'scorpion' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 9, bottomLevel: 8, modelId: 'eagle' },
      { topPartId: 'quadratic', bottomPartId: 'balanced', topLevel: 8, bottomLevel: 9, modelId: 'prisma' }
    ],
    rewardWin: 420, rewardLose: 120
  },
  {
    id: 30, name: 'Final Chaos',
    enemyTeam: [
      { topPartId: 'star', bottomPartId: 'speedy', topLevel: 10, bottomLevel: 9, modelId: 'fire' },
      { topPartId: 'star', bottomPartId: 'tanky', topLevel: 9, bottomLevel: 10, modelId: 'thunderstorm' },
      { topPartId: 'triangle', bottomPartId: 'speedy', topLevel: 10, bottomLevel: 9, modelId: 'scorpion' },
      { topPartId: 'cushioned', bottomPartId: 'tanky', topLevel: 9, bottomLevel: 10, modelId: 'castle' }
    ],
    rewardWin: 500, rewardLose: 150
  }
]

// ─── Upgrade Definitions ────────────────────────────────────────────────────

/** Per-level bonus for each top part (leans into the part's identity) */
export const TOP_UPGRADE_BONUS: Record<TopPartId, { damage: number; defense: number; hp: number }> = {
  star: { damage: 0.12, defense: 0.03, hp: 1 },  // glass cannon
  triangle: { damage: 0.08, defense: 0.05, hp: 2 },  // aggressive balanced
  round: { damage: 0.04, defense: 0.08, hp: 4 },  // defensive
  quadratic: { damage: 0.06, defense: 0.06, hp: 3 },  // true balanced
  cushioned: { damage: 0.03, defense: 0.10, hp: 5 }   // pure tank
}

/** Per-level bonus for each bottom part */
export const BOTTOM_UPGRADE_BONUS: Record<BottomPartId, { speed: number; decay: number; hp: number }> = {
  speedy: { speed: 0.06, decay: 0.00015, hp: 1 },  // leans into speed
  tanky: { speed: 0.02, decay: 0.00020, hp: 4 },  // leans into survival
  balanced: { speed: 0.04, decay: 0.00018, hp: 2 }   // balanced
}

/** Cost for upgrading to a given level: 100 + (level - 1) * 20 */
export const upgradeCost = (toLevel: number): number =>
  100 + (toLevel - 1) * 20

// ─── Persistence ────────────────────────────────────────────────────────────

const STAGE_KEY = 'bayblade_campaign_stage'
const UPGRADES_KEY = 'bayblade_upgrades'

export interface PlayerUpgrades {
  tops: Record<TopPartId, number>
  bottoms: Record<BottomPartId, number>
}

const DEFAULT_UPGRADES: PlayerUpgrades = {
  tops: { star: 0, triangle: 0, round: 0, quadratic: 0, cushioned: 0 },
  bottoms: { speedy: 0, tanky: 0, balanced: 0 }
}

const loadStage = (): number => {
  try {
    const raw = localStorage.getItem(STAGE_KEY)
    if (raw) {
      const n = parseInt(raw, 10)
      if (n >= 1 && n <= STAGES.length) return n
    }
  } catch { /* fall through */
  }
  return 1
}

const loadUpgrades = (): PlayerUpgrades => {
  try {
    const raw = localStorage.getItem(UPGRADES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.tops && parsed?.bottoms) return parsed
    }
  } catch { /* fall through */
  }
  return JSON.parse(JSON.stringify(DEFAULT_UPGRADES))
}

// ─── Singleton State ────────────────────────────────────────────────────────

const currentStageId: Ref<number> = ref(loadStage())
const playerUpgrades: Ref<PlayerUpgrades> = ref(loadUpgrades())

// ─── Derived ────────────────────────────────────────────────────────────────

const currentStage = computed(() =>
  STAGES.find(s => s.id === currentStageId.value) ?? STAGES[0]!
)

const isLastStage = computed(() =>
  currentStageId.value >= STAGES.length
)

// ─── Actions ────────────────────────────────────────────────────────────────

const saveState = () => {
  localStorage.setItem(STAGE_KEY, currentStageId.value.toString())
  localStorage.setItem(UPGRADES_KEY, JSON.stringify(playerUpgrades.value))
}

const advanceStage = () => {
  if (currentStageId.value < STAGES.length) {
    currentStageId.value++
    saveState()
  }
}

const upgradeTop = (partId: TopPartId): boolean => {
  const current = playerUpgrades.value.tops[partId]
  const cost = upgradeCost(current + 1)
  // Caller is responsible for checking coins — return false if level is already maxed
  playerUpgrades.value = {
    ...playerUpgrades.value,
    tops: { ...playerUpgrades.value.tops, [partId]: current + 1 }
  }
  saveState()
  return true
}

const upgradeBottom = (partId: BottomPartId): boolean => {
  const current = playerUpgrades.value.bottoms[partId]
  const cost = upgradeCost(current + 1)
  playerUpgrades.value = {
    ...playerUpgrades.value,
    bottoms: { ...playerUpgrades.value.bottoms, [partId]: current + 1 }
  }
  saveState()
  return true
}

// ─── Public API ─────────────────────────────────────────────────────────────

const useBaybladeCampaign = () => ({
  currentStageId,
  currentStage,
  isLastStage,
  playerUpgrades,
  advanceStage,
  upgradeTop,
  upgradeBottom,
  upgradeCost
})

export default useBaybladeCampaign
