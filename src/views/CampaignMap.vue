<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useCampaign, type CampaignNode, demoCampaignNodes } from '@/use/useCampaign'
import NodePopup from '@/components/organisms/NodePopup'
import FButton from '@/components/atoms/FButton'
import QuestReward from '@/components/QuestReward.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {} from '@/use/useMatch'
import useUser, { isMobileLandscape, isMobilePortrait, windowWidth, windowHeight, isDemo } from '@/use/useUser'
import useModels from '@/use/useModels'
import type { GameCard } from '@/types/game'

const { t } = useI18n()
const router = useRouter()
const { campaignNodes, mobileNodes, selectedNodeId, activeNode } = useCampaign()
const { userQuestCampaign, userQuestCards, userCollection, setSettingValue } = useUser()
const { allModels } = useModels()

const showQuestReward = ref(false)
const questType = ref<'campaign' | 'demo-campaign' | 'cards'>('campaign')

const isLandscape = ref(windowWidth.value > windowHeight.value)

const nodesList = computed(() => {
  if (isMobilePortrait.value) {
    return campaignNodes.value.map((node, index) => ({
      ...node, position: mobileNodes[index]?.positionPortrait || { x: 0, y: 0 }
    }))
  }
  if (isMobileLandscape.value) {
    return campaignNodes.value.map((node, index) => ({
      ...node, position: mobileNodes[index]?.positionLandscape || { x: 0, y: 0 }
    }))
  }
  return campaignNodes.value
})

const getCurvePath = (startNode: CampaignNode, targetId: string) => {
  const endNode = nodesList.value.find(n => n.id === targetId)
  if (!endNode) return ''

  const x1 = startNode.position.x
  const y1 = startNode.position.y
  const x2 = endNode.position.x
  const y2 = endNode.position.y

  const cx = (x1 + x2) / 2 + (y2 - y1) * 0.1
  const cy = (y1 + y2) / 2 - (x2 - x1) * 0.1

  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

const getPathClass = (startNode: CampaignNode, targetId: string) => {
  const endNode = nodesList.value.find(n => n.id === targetId)
  if (!endNode) return 'opacity-0'

  if (endNode.unlocked) return 'opacity-100 stroke-yellow-400'
  return 'opacity-50 stroke-grey-500'
}

let demoCampaignFinished = false
const checkQuests = () => {
  // 1. Check Campaign Completion
  const allNodesCompleted = campaignNodes.value.every(node => node.completed)
  if (allNodesCompleted && !userQuestCampaign.value) {
    questType.value = 'campaign'
    showQuestReward.value = true
    return // Show one at a time
  }

  if (isDemo) {
    // 1.5. Check Demo Campaign Completion
    const allDemoNodesCompleted = demoCampaignNodes.every(demo => campaignNodes.value.some(node => demo.id === node.id && node.completed))
    if (allDemoNodesCompleted && !demoCampaignFinished) {
      questType.value = 'demo-campaign'
      showQuestReward.value = true
      demoCampaignFinished = true
      return // Show one at a time
    }
  }

  // 2. Check Card Collection Completion
  const parsedCollection = JSON.parse(userCollection.value || '[]')
  const collectedIds = new Set(parsedCollection.filter((c: any) => c.count >= 1).map((c: any) => c.id))
  const hasEveryCard = allModels.every((card: GameCard) => collectedIds.has(card.id))

  if (hasEveryCard && !userQuestCards.value) {
    questType.value = 'cards'
    showQuestReward.value = true
  }
}

const handleQuestClose = () => {
  showQuestReward.value = false
  if (questType.value === 'campaign') setSettingValue('quest-campaign', true)
  else setSettingValue('quest-cards', true)
  setTimeout(checkQuests, 500)
}

onMounted(() => {
  if (playerSelection.value.length < 5) {
    return router.replace({ name: 'deck' })
  }

  selectedNodeId.value = null
  setTimeout(checkQuests, 1000)
})

onUnmounted(() => {
})

const startBattle = (rules: any[]) => {
  router.push({ name: 'battle' })
}
</script>

<template lang="pug">
  //- Use fixed inset-0 and remove padding to ensure the background fills the notch area
  div.fixed.inset-0.bg-slate-900.overflow-hidden.flex.items-center.justify-center.game-ui-immune

    //- 1. Backgrounds (The Table)
    img.absolute.inset-0.w-full.h-full.object-fill.select-none(
      src="/images/bg/oak_600x588.webp"
      alt="table-image"
    )

    //- 2. The Interactive Map Scaler
    //- We wrap the specific map image inside the scaler to ensure they share the exact same bounds
    div.relative.map-scaler.flex.items-center.justify-center(
      :style="{\
        aspectRatio: isMobilePortrait ? '800 / 1600' : isMobileLandscape ? '1600 / 800': '800 / 710',\
        maxHeight: '100dvh', \
        maxWidth: '100dvw' \
      }"
      class="m-auto"
      :class="isMobileLandscape || !isMobilePortrait ? 'h-full w-auto' : 'w-full h-auto'"
    )
      //- The Map Image (Now contained strictly within the scaler)
      img.w-full.h-full.object-fill.select-none(
        v-if="isMobilePortrait"
        src="/images/bg/campaign-map_800x1600.webp"
      )
      img.w-full.h-full.object-contain.select-none(
        v-else-if="isMobileLandscape"
        src="/images/bg/campaign-map_1600x800.webp"
      )
      img.w-full.h-full.object-contain.select-none(
        v-else
        src="/images/bg/campaign-map_800x710.webp"
      )

      //- 3. The Interactive Node Layer
      div.absolute.inset-0.node-layer-container
        //- SVG Path Layer
        svg.absolute.inset-0.w-full.h-full.pointer-events-none.overflow-visible(
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        )
          defs
            filter#glow
              feGaussianBlur(stdDeviation="0.5" result="coloredBlur")
              feMerge
                feMergeNode(in="coloredBlur")
                feMergeNode(in="SourceGraphic")

          template(v-for="node in nodesList" :key="'paths-' + node.id")
            path(
              v-for="targetId in node.unlocks"
              :key="node.id + '-' + targetId"
              :d="getCurvePath(node, targetId)"
              fill="none"
              stroke="white"
              stroke-width="0.5"
              stroke-dasharray="1, 1"
              :class="getPathClass(node, targetId)"
              style="filter: url(#glow)"
            )

        //- The Stations (Nodes)
        button.absolute.transform.transition-all.duration-300(
          v-for="node in nodesList"
          :key="node.id"
          :style="{ left: node.position.x + '%', top: node.position.y + '%' }"
          @click="node.unlocked && (selectedNodeId = node.id)"
          :class="[\
            '-translate-x-1/2 -translate-y-1/2',\
            node.unlocked ? 'scale-80 hover:scale-100 cursor-pointer' : 'scale-65 opacity-70 cursor-not-allowed grayscale',\
            selectedNodeId === node.id ? 'z-30' : 'z-10'\
          ]"
        )
          div.relative.w-8.h-8.rounded-full.flex.items-center.justify-center.shadow-2xl.border-2(
            class="sm:w-12 sm:h-12 sm:border-3 md:border-4 md:w-16 md:h-16 bg-slate-800/50"
            :class="node.completed ? 'border-green-600' : 'border-yellow-500'"
          )
            span.text-base(v-if="node.completed" class="sm:text-xl") ✅
            span.text-base(v-else-if="!node.unlocked" class="sm:text-xl") 🔒
            span.text-base.animate-pulse(v-else class="sm:text-xl") ⚔️
            div.absolute.inset-0.rounded-full.animate-ping.bg-yellow-400.opacity-40(v-if="node.unlocked && !node.completed")

      //- 4. NodePopup placed inside the relative container to expand from map center
      NodePopup(
        v-if="activeNode"
        :node="activeNode"
        @close="selectedNodeId = null"
        @start="startBattle(activeNode.rules)"
      )

    //- 5. UI Buttons (Always relative to screen edges)
    div.fixed.bottom-0.left-0.z-40.p-6(
      style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); padding-left: calc(1.5rem + env(safe-area-inset-left));"
    )
      FButton(
        type="secondary"
        size="md"
        @click="router.push({ name: 'deck' })"
      ) {{ t('back') }}

    //- Quest Reward Dialog
    QuestReward(
      v-if="showQuestReward"
      :modelValue="showQuestReward"
      :type="questType"
      @close="handleQuestClose"
    )
</template>

<style lang="sass" scoped>
.node-layer-container
  pointer-events: none

  button
    pointer-events: auto

path
  transition: all 0.5s ease

  &.stroke-yellow-400
    stroke-dashoffset: 100
    animation: flow 20s linear infinite

@keyframes flow
  to
    stroke-dashoffset: 0
</style>