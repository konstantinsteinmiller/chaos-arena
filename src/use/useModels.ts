import { prependBaseUrl } from '@/utils/function'
import { type Element, ELEMENTS } from '@/utils/enums'
import { isCampaignTest, isDbInitialized, isDebug } from '@/use/useMatch'
import useUser from '@/use/useUser'
import { computed, watch } from 'vue'
import type { TopPartId } from '@/types/bayblade'

export const modelImgPath = (id: string) => {
  return prependBaseUrl(`images/models/${id}_256x256.webp`)
}

// ─── Bayblade Model Image Mapping ───────────────────────────────────────────

export const BAYBLADE_MODEL_IDS = [
  'fire', 'phoenix', 'thunder', 'bluedragon', 'turtle',
  'ice', 'chip', 'mysticaleye', 'nature', 'wulf'
] as const

export type BaybladeModelId = (typeof BAYBLADE_MODEL_IDS)[number]

/** Maps each top part to a player and NPC model image */
export const BAYBLADE_MODEL_MAP: Record<TopPartId, { player: BaybladeModelId; npc: BaybladeModelId }> = {
  star: { player: 'fire', npc: 'phoenix' },
  triangle: { player: 'thunder', npc: 'bluedragon' },
  round: { player: 'turtle', npc: 'ice' },
  quadratic: { player: 'chip', npc: 'mysticaleye' },
  cushioned: { player: 'nature', npc: 'wulf' }
}

/** Get the resolved image path for a bayblade given its top part and owner */
export const baybladeModelImgPath = (topPartId: TopPartId, owner: 'player' | 'npc'): string => {
  const mapping = BAYBLADE_MODEL_MAP[topPartId]
  const modelId = owner === 'player' ? mapping.player : mapping.npc
  return modelImgPath(modelId)
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