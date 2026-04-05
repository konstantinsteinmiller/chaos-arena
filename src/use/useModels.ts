import { prependBaseUrl } from '@/utils/function'
import { type Element, ELEMENTS } from '@/utils/enums'
import { isCampaignTest, isDbInitialized, isDebug } from '@/use/useMatch'
import useUser from '@/use/useUser'
import { computed, watch } from 'vue'

export const modelImgPath = (id: string, element: string) => {
  try {
    if (!element) throw new Error('Element is required')
  } catch (error) {
    console.error('Error in modelImgPath:', error)
    return ''
  }
  return prependBaseUrl(`models/${element}/${id}_400x400.webp`)
}

/**
 * models
 */
export interface Card {
  id: string
  name: string
  element: Element
  values: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

// export type InventoryCard = Card & { count: number }

export interface StoredCollectionCard {
  id: string
  count: number
}

const useModels = () => {
  const allModels: Card[] = [
    { id: 'postman-middle', name: 'Quicklin', element: ELEMENTS.AIR, values: { top: 4, right: 5, bottom: 8, left: 4 } }, // Total: 21
    { id: 'gorilla-middle', name: 'Gondix', element: ELEMENTS.AIR, values: { top: 8, right: 5, bottom: 8, left: 1 } },
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