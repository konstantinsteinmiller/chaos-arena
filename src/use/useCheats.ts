import { onMounted, onUnmounted, ref } from 'vue'
import useModels from '@/use/useModels'
import useUser, { isDemo } from '@/use/useUser'
import useCampaign, { demoCampaignNodes, type MobileNode } from '@/use/useCampaign'
import useBaybladeCampaign, { STAGES, type ArenaType } from '@/use/useBaybladeCampaign'
import { arenaType } from '@/use/useBaybladeGame'
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

  const setBaybladeStage = (stageId: number) => {
    console.log('stageId: ', stageId)
    if (stageId < 1 || stageId > STAGES.length) {
      console.warn(`[CHEAT] Invalid stage ${stageId}. Must be 1-${STAGES.length}.`)
      return
    }
    const { currentStageId } = useBaybladeCampaign()
    currentStageId.value = stageId
    localStorage.setItem('bayblade_campaign_stage', stageId.toString())
    console.warn(`[CHEAT] Bayblade stage set to ${stageId} (${STAGES[stageId - 1]?.name}).`)
  }

  const resetChestCooldown = () => {
    localStorage.setItem('bayblade_chest_ready_at', '0')
    console.warn('[CHEAT] Chest cooldown reset to 00:00.')
  }

  const setArenaType = (type: ArenaType) => {
    arenaType.value = type
    console.warn(`[CHEAT] Arena type set to '${type}'.`)
  }

  /** Jump forward/backward by 10 stages */
  const shiftBaybladeStage = (delta: number) => {
    const { currentStageId } = useBaybladeCampaign()
    const newStage = Math.max(1, Math.min(STAGES.length, currentStageId.value + delta))
    setBaybladeStage(newStage)
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
    'ctrl+shift+d': () => console.log('[DEBUG] Cards:', allModels),
    // Bayblade stage shortcuts: Ctrl+Shift+1..9 for stages 1-9, Ctrl+Shift+0 for stage 10
    'ctrl+shift+1': () => setBaybladeStage(1),
    'ctrl+shift+2': () => setBaybladeStage(2),
    'ctrl+shift+3': () => setBaybladeStage(3),
    'ctrl+shift+4': () => setBaybladeStage(4),
    'ctrl+shift+5': () => setBaybladeStage(5),
    'ctrl+shift+6': () => setBaybladeStage(6),
    'ctrl+shift+7': () => setBaybladeStage(7),
    'ctrl+shift+8': () => setBaybladeStage(8),
    'ctrl+shift+o': () => setBaybladeStage(9),
    'ctrl+shift+p': () => setBaybladeStage(10),
    'ctrl+shift+alt+1': () => setBaybladeStage(11),
    'ctrl+shift+alt+2': () => setBaybladeStage(12),
    'ctrl+shift+alt+3': () => setBaybladeStage(13),
    'ctrl+shift+alt+4': () => setBaybladeStage(14),
    'ctrl+shift+alt+5': () => setBaybladeStage(15),
    'ctrl+shift+alt+6': () => setBaybladeStage(16),
    'ctrl+shift+alt+7': () => setBaybladeStage(17),
    'ctrl+shift+alt+8': () => setBaybladeStage(18),
    'ctrl+shift+alt+9': () => setBaybladeStage(19),
    'ctrl+shift+alt+0': () => setBaybladeStage(20),
    'ctrl+shift+alt+t': resetChestCooldown,
    // Arena type shortcuts
    'ctrl+shift+alt+l': () => setArenaType('lava'),
    'ctrl+shift+alt+i': () => setArenaType('ice'),
    'ctrl+shift+alt+f': () => setArenaType('forest'),
    'ctrl+shift+alt+d': () => setArenaType('default'),
    'ctrl+shift+alt+b': () => setArenaType('boss'),
    'ctrl+shift+alt+h': () => setArenaType('thunder')
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
    // Use e.code for digits (Shift+1 produces '!' in e.key on US keyboards)
    let mainKey = e.key.toLowerCase()
    const codeMatch = e.code.match(/^Digit(\d)$/)
    if (codeMatch) mainKey = codeMatch[1]

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