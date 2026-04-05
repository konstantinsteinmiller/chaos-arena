import { onMounted, onUnmounted, ref } from 'vue'
import useModels from '@/use/useModels'
import useUser, { isDemo } from '@/use/useUser'
import useCampaign, { demoCampaignNodes, type MobileNode } from '@/use/useCampaign'
import type { GameCard } from '@/types/game'

const storedCheat = localStorage.getItem('cheat') || 'false'
const isCheat = ref<boolean>(JSON.parse(storedCheat))


const useCheats = () => {
  if (!isCheat.value) return {}
  const { saveCampaign } = useCampaign()

  const { allModels } = useModels()
  const { setSettingValue } = useUser()
  const { campaignNodes } = useCampaign()

  /**
   * ACTIONS
   */
  const unlockAllCards = () => {
    const allCardsCollectionDebug = allModels.map((card: GameCard) => ({
      id: card.id,
      count: 1
    }))
    setSettingValue('collection', allCardsCollectionDebug)
    console.warn('[CHEAT] All cards unlocked.')
  }

  const unlockAllCampaignNodes = () => {
    campaignNodes.value = campaignNodes.value.map(node => ({ ...node, completed: true, unlocked: true }))
    console.warn('[CHEAT] All campaign nodes completed.')
  }

  const unlockAllDemoCampaignNodes = () => {
    if (!isDemo) return
    // campaignNodes.value = campaignNodes.value.reduce((all, node) => {
    //   return all.concat([{ ...node, completed: demoCampaignNodes.some(demo => demo.id === node.id) }])
    // }, [])
    campaignNodes.value = campaignNodes.value.reduce((all, node) => {
      return all.concat([{
        ...node,
        completed: demoCampaignNodes.some(demo => demo.id === node.id) && node.id !== 'node-e2-b' && node.id !== 'node-w2'
      }])
    }, [])
    saveCampaign({ id: 'node-w-all', knownCards: [] })

    console.warn('[CHEAT] All DEMO campaign nodes completed.')
  }

  const printAllIds = () => {
    const youngIds = allModels.filter((card: GameCard) => card.id.includes('-young'))
    const middleIds = allModels.filter((card: GameCard) => card.id.includes('-middle'))
    const oldIds = allModels.filter((card: GameCard) => card.id.includes('-old'))
    console.warn('[CHEAT] All sorted ids.', youngIds, middleIds, oldIds)
  }

  const resetCampaign = () => {
    setSettingValue('campaign', [])
    setSettingValue('quest-campaign', false)
    console.warn('[CHEAT] Campaign progress reset.')
  }

  /**
   * CHEAT MAPPING
   * Define your shortcuts here.
   * Format: 'ctrl+shift+key' or just 'key'
   * Note: 'ctrl' also catches 'meta' (Cmd on Mac) for better UX.
   */
  const cheatsMap: Record<string, () => void> = {
    'ctrl+shift+c': unlockAllCards,
    'ctrl+shift+b': unlockAllCampaignNodes,
    'ctrl+shift+g': unlockAllDemoCampaignNodes,
    'ctrl+shift+j': resetCampaign,
    'ctrl+shift+k': printAllIds,
    'ctrl+shift+d': () => console.log('[DEBUG] Cards:', allModels)
  }

  /**
   * EVENT HANDLER
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    const keys = []

    // 1. Build the modifier prefix
    if (e.ctrlKey || e.metaKey) keys.push('ctrl')
    if (e.shiftKey) keys.push('shift')
    if (e.altKey) keys.push('alt')

    // 2. Add the actual key (normalized to lowercase)
    const mainKey = e.key.toLowerCase()

    // console.log('keys: ', keys)
    // Avoid adding 'control', 'shift', etc., as the main key if they are modifiers
    if (!['control', 'shift', 'alt', 'meta'].includes(mainKey)) {
      keys.push(mainKey)
    }

    // 3. Join and match
    const shortcut = keys.join('+')

    if (cheatsMap[shortcut]) {
      e.preventDefault()
      cheatsMap[shortcut]()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, { passive: false })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    isCheat
  }
}

export default useCheats