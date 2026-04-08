import { prependBaseUrl } from '@/utils/function'
import { type Element, ELEMENTS } from '@/utils/enums'
import { isCampaignTest, isDbInitialized, isDebug } from '@/use/useMatch'
import useUser from '@/use/useUser'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { TopPartId } from '@/types/bayblade'

export const modelImgPath = (id: string) => {
  return prependBaseUrl(`images/models/${id}_256x256.webp`)
}

// ─── Bayblade Model Image Mapping ───────────────────────────────────────────

export const BAYBLADE_MODEL_IDS = [
  'fire', 'phoenix', 'thunder', 'bluedragon', 'turtle',
  'ice', 'chip', 'mysticaleye', 'nature', 'wulf',
  'castle', 'eagle', 'prisma', 'scorpion', 'shell', 'snake', 'thunderstorm'
] as const

export type BaybladeModelId = (typeof BAYBLADE_MODEL_IDS)[number]

/** Maps each top part to a player and default NPC model image */
export const BAYBLADE_MODEL_MAP: Record<TopPartId, { player: BaybladeModelId; npc: BaybladeModelId }> = {
  star: { player: 'fire', npc: 'phoenix' },
  triangle: { player: 'thunder', npc: 'bluedragon' },
  round: { player: 'turtle', npc: 'ice' },
  quadratic: { player: 'chip', npc: 'mysticaleye' },
  cushioned: { player: 'nature', npc: 'wulf' },
  piercer: { player: 'scorpion', npc: 'snake' }
}

/** Skin display names */
export const MODEL_LABELS: Record<BaybladeModelId, string> = {
  fire: 'Fire',
  phoenix: 'Phoenix',
  thunder: 'Thunder',
  bluedragon: 'Blue Dragon',
  turtle: 'Turtle',
  ice: 'Ice',
  chip: 'Chip',
  mysticaleye: 'Mystic Eye',
  nature: 'Nature',
  wulf: 'Wulf',
  castle: 'Castle',
  eagle: 'Eagle',
  prisma: 'Prisma',
  scorpion: 'Scorpion',
  shell: 'Shell',
  snake: 'Snake',
  thunderstorm: 'Thunderstorm'
}

/** Available skins per top part (default skin is always first and free) */
export const SKINS_PER_TOP: Record<TopPartId, BaybladeModelId[]> = {
  star: ['fire', 'phoenix', 'thunderstorm'],
  triangle: ['thunder', 'bluedragon', 'eagle'],
  round: ['turtle', 'ice', 'shell'],
  quadratic: ['chip', 'mysticaleye', 'prisma'],
  cushioned: ['nature', 'wulf', 'castle'],
  piercer: ['scorpion', 'snake', 'eagle']
}

export const SKIN_COST = 300

// ─── Skin Persistence (singleton) ───────────────────────────────────────────

const SKINS_KEY = 'bayblade_owned_skins'
const SELECTED_SKINS_KEY = 'bayblade_selected_skins'
const PICKER_OPENED_KEY = 'bayblade_skin_picker_opened'

const loadOwnedSkins = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SKINS_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* fall through */
  }
  return new Set()
}

const loadSelectedSkins = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(SELECTED_SKINS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */
  }
  return {}
}

const loadPickerOpened = (): Set<string> => {
  try {
    const raw = localStorage.getItem(PICKER_OPENED_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* fall through */
  }
  return new Set()
}

const ownedSkins: Ref<Set<string>> = ref(loadOwnedSkins())
const selectedSkins: Ref<Record<string, string>> = ref(loadSelectedSkins())
const pickerOpenedParts: Ref<Set<string>> = ref(loadPickerOpened())

const saveOwnedSkins = () => {
  localStorage.setItem(SKINS_KEY, JSON.stringify([...ownedSkins.value]))
}

const saveSelectedSkins = () => {
  localStorage.setItem(SELECTED_SKINS_KEY, JSON.stringify(selectedSkins.value))
}

const savePickerOpened = () => {
  localStorage.setItem(PICKER_OPENED_KEY, JSON.stringify([...pickerOpenedParts.value]))
}

/** Mark that the player has opened the skin picker for the given top part. */
export const markSkinPickerOpened = (topPartId: TopPartId) => {
  if (pickerOpenedParts.value.has(topPartId)) return
  pickerOpenedParts.value = new Set([...pickerOpenedParts.value, topPartId])
  savePickerOpened()
}

export const wasSkinPickerOpened = (topPartId: TopPartId): boolean =>
  pickerOpenedParts.value.has(topPartId)

/** All currently-owned skins for a top part (in declared order). */
export const ownedSkinsForTop = (topPartId: TopPartId): BaybladeModelId[] =>
  SKINS_PER_TOP[topPartId].filter(id => isSkinOwned(topPartId, id))

/** True if at least one skin in this top part's catalog is not yet owned. */
export const hasUnownedSkinsForTop = (topPartId: TopPartId): boolean =>
  SKINS_PER_TOP[topPartId].some(id => !isSkinOwned(topPartId, id))

/** Default skins (first in each list) are always owned */
export const isSkinOwned = (topPartId: TopPartId, modelId: BaybladeModelId): boolean => {
  if (SKINS_PER_TOP[topPartId][0] === modelId) return true
  return ownedSkins.value.has(`${topPartId}:${modelId}`)
}

export const buySkin = (topPartId: TopPartId, modelId: BaybladeModelId): boolean => {
  if (isSkinOwned(topPartId, modelId)) return false
  ownedSkins.value = new Set([...ownedSkins.value, `${topPartId}:${modelId}`])
  saveOwnedSkins()
  return true
}

export const selectSkin = (topPartId: TopPartId, modelId: BaybladeModelId) => {
  selectedSkins.value = { ...selectedSkins.value, [topPartId]: modelId }
  saveSelectedSkins()
}

export const getSelectedSkin = (topPartId: TopPartId): BaybladeModelId => {
  const sel = selectedSkins.value[topPartId] as BaybladeModelId | undefined
  if (sel && isSkinOwned(topPartId, sel)) return sel
  return BAYBLADE_MODEL_MAP[topPartId].player
}

/** Get the resolved image path for a bayblade given its top part, owner, and optional override */
export const baybladeModelImgPath = (topPartId: TopPartId, owner: 'player' | 'npc', modelOverride?: string): string => {
  if (modelOverride) return modelImgPath(modelOverride)
  if (owner === 'player') return modelImgPath(getSelectedSkin(topPartId))
  return modelImgPath(BAYBLADE_MODEL_MAP[topPartId].npc)
}

/**
 * models
 */
export interface Card {
  id: string
  name: string
}

// export type InventoryCard = Card & { count: number }

export interface StoredCollectionCard {
  id: string
  count: number
}

const useModels = () => {
  const allModels: Card[] = [
    { id: 'postman-middle', name: 'Quicklin' },
    { id: 'gorilla-middle', name: 'Gondix' }
  ]

  const { setSettingValue, userCollection } = useUser()

  // const saveCollection = (collection: Array<InventoryCard | StoredCollectionCard>) => {
  //   const storedCollection: StoredCollectionCard[] = collection.map(card => ({ id: card.id, count: card.count }))
  //   setSettingValue('collection', storedCollection)
  // }

  const storedCollection = computed(() => {
    return typeof userCollection.value === 'string'
      ? JSON.parse(userCollection.value)
      : userCollection.value
  })

  // watch(isDbInitialized, () => {
  //   if (storedCollection.value.length >= 1 && storedCollection.value.every((card: StoredCollectionCard) => card.count === 0)) {
  //     saveCollection([])
  //   }
  // }, { immediate: true, once: true })

  return {
    allModels,
    // saveCollection,
    modelImgPath
  }
}

export default useModels