<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FButton from '@/components/atoms/FButton'
import FIconButton from '@/components/atoms/FIconButton'
import FReward from '@/components/atoms/FReward'
import BaybladeConfigModal from '@/components/organisms/BaybladeConfigModal'
import useBaybladeGame from '@/use/useBaybladeGame'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import type { BaybladeConfig } from '@/types/bayblade'

// ─── Game & Config ─────────────────────────────────────────────────────────

const {
  phase,
  gameResult,
  turnAnnouncement,
  playerBlades,
  npcBlades,
  isDragging,
  initGame,
  startMatch,
  beginDrag,
  updateDrag,
  releaseDrag,
  forceReleaseDragAtMax,
  stopPhysics,
  render,
  pixelToGame
} = useBaybladeGame()

const { playerTeam, coins, saveTeam, addCoins } = useBaybladeConfig()
const { t } = useI18n()

// ─── Canvas Refs ───────────────────────────────────────────────────────────

const canvasRef: Ref<HTMLCanvasElement | null> = ref(null)
const canvasSize: Ref<number> = ref(0)
const configModalOpen: Ref<boolean> = ref(false)
const coinsAwarded: Ref<boolean> = ref(false)

// ─── NPC Team Configs (randomized each game) ──────────────────────────────

const NPC_POOL: BaybladeConfig[] = [
  { topPartId: 'triangle', bottomPartId: 'balanced' },
  { topPartId: 'star', bottomPartId: 'speedy' },
  { topPartId: 'round', bottomPartId: 'tanky' },
  { topPartId: 'quadratic', bottomPartId: 'balanced' },
  { topPartId: 'cushioned', bottomPartId: 'tanky' }
]

const randomNpcTeam = (): BaybladeConfig[] => {
  const shuffled = [...NPC_POOL].sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1]]
}

// ─── Computed ──────────────────────────────────────────────────────────────

const isGameOver = computed(() => phase.value === 'game_over')
const showReward: Ref<boolean> = ref(false)

const resultText = computed(() => {
  if (gameResult.value === 'win') return t('bayblade.youWin')
  if (gameResult.value === 'lose') return t('bayblade.youLose')
  return ''
})

const rewardAmount = computed(() =>
  gameResult.value === 'win' ? 100 : 40
)

// Config button: only when game over and no new game started
const showConfigButton = computed(() =>
  phase.value === 'game_over' || phase.value === 'idle' || phase.value === 'tap_to_start'
)

const showTurnIndicator = computed(() =>
  phase.value !== 'idle'
  && phase.value !== 'tap_to_start'
  && phase.value !== 'meteor_intro'
  && phase.value !== 'game_over'
  && phase.value !== 'deciding_turn'
)

// ─── Canvas Sizing ─────────────────────────────────────────────────────────

const updateCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.99
  canvasSize.value = size
  canvas.width = size
  canvas.height = size
}

// ─── Pointer Event Handlers ────────────────────────────────────────────────

const getGameCoords = (e: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return pixelToGame(
    e.clientX - rect.left,
    e.clientY - rect.top,
    canvasSize.value
  )
}

const onPointerDown = (e: PointerEvent) => {
  if (phase.value === 'tap_to_start') {
    startMatch()
    return
  }
  const coords = getGameCoords(e)
  beginDrag(coords.x, coords.y)
}

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return
  const coords = getGameCoords(e)
  updateDrag(coords.x, coords.y)
}

const onPointerUp = () => {
  if (!isDragging.value) return
  releaseDrag()
}

const onPointerLeave = () => {
  if (!isDragging.value) return
  forceReleaseDragAtMax()
}

// ─── Game Over ─────────────────────────────────────────────────────────────

watch(isGameOver, (over) => {
  if (over && !coinsAwarded.value) {
    addCoins(rewardAmount.value)
    coinsAwarded.value = true
    showReward.value = true
  }
})

const onRewardContinue = () => {
  showReward.value = false
}

const onPlayAgain = () => {
  showReward.value = false
  coinsAwarded.value = false
  initGame(playerTeam.value, randomNpcTeam())
}

const onOpenConfig = () => {
  configModalOpen.value = true
}

const onConfigSave = (team: BaybladeConfig[]) => {
  saveTeam(team)
  configModalOpen.value = false
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

let renderRafId: number | null = null

const renderLoop = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  render(ctx, canvasSize.value)
  renderRafId = requestAnimationFrame(renderLoop)
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)

  initGame(playerTeam.value, randomNpcTeam())
  renderRafId = requestAnimationFrame(renderLoop)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  stopPhysics()
  if (renderRafId !== null) cancelAnimationFrame(renderRafId)
})
</script>

<template lang="pug">
  div.relative.w-screen.h-screen.overflow-hidden.flex.items-center.justify-center(
    class="bg-[#0a0e17]"
  )
    //- Game Canvas
    canvas(
      ref="canvasRef"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerLeave"
      @pointerleave="onPointerLeave"
      class="block touch-none"
    )

    //- HUD Overlay
    div.absolute.inset-0.pointer-events-none

      //- Top bar: turn indicator + coins
      div.flex.justify-between.items-start.p-3(class="sm:p-4")
        //- Turn indicator
        div(
          v-if="showTurnIndicator"
          class="px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm text-white"
          :class="phase.includes('player') ? 'bg-blue-600' : 'bg-red-600'"
        )
          | {{ phase.includes('player') ? 'YOUR TURN' : 'NPC TURN' }}
        div(v-else)

        //- Coin counter
        div.flex.items-center.gap-2.rounded-lg.text-white.font-bold(
          class="px-3 py-1.5 bg-yellow-600/80 text-sm sm:text-base"
        )
          svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 text-yellow-300")
            circle(cx="12" cy="12" r="10" fill="currentColor")
            text(x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#92400e") $
          span {{ coins }}

      //- Center overlay messages
      div.absolute.flex.items-center.justify-center(class="inset-0 z-[10]")

        //- Tap to Start
        div(
          v-if="phase === 'tap_to_start'"
          class="text-center pointer-events-auto cursor-pointer"
          @click="startMatch"
        )
          div.text-white.font-black.uppercase.tracking-wider.animate-pulse(
            class="text-3xl sm:text-5xl mb-2"
          ) Tap to Start
          div.text-white.italic(class="text-sm sm:text-lg opacity-60")
            | Click or tap the arena

        //- Turn Announcement
        div(
          v-else-if="phase === 'deciding_turn' && turnAnnouncement"
          class="text-center"
        )
          div.text-white.font-black.uppercase.tracking-wider.animate-pulse(
            class="text-2xl sm:text-4xl"
          ) {{ turnAnnouncement }}

        //- Player turn hint
        div(
          v-else-if="phase === 'player_turn'"
          class="absolute bottom-16 sm:bottom-20 text-center"
        )
          div.text-white.italic(class="text-xs sm:text-sm opacity-50")
            | Tap a blade, then drag to launch

        //- Game Over (inline minimal — full reward shown via FReward overlay)
        div(
          v-else-if="phase === 'game_over' && !showReward"
          class="text-center"
        )
          div.font-black.uppercase.tracking-wider(
            class="text-4xl sm:text-6xl mb-3"
            :class="gameResult === 'win' ? 'text-green-400' : 'text-red-400'"
          ) {{ resultText }}

          div.flex.flex-col.items-center.gap-3.pointer-events-auto
            FButton(@click="onPlayAgain") {{ t('bayblade.playAgain') }}

      //- Bottom-right config button (game over / idle only)
      div(
        v-if="showConfigButton && !showReward"
        class="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-auto"
      )
        FIconButton(
          type="secondary"
          size="lg"
          img-src="/images/icons/team_128x128.webp"
          @click="onOpenConfig"
        )

    //- Reward Overlay
    FReward(
      v-model="showReward"
      :show-continue="true"
      @continue="onRewardContinue"
    )
      template(#ribbon)
        span.text-white.font-black.uppercase.italic {{ t('bayblade.rewards') }}
      div.flex.flex-col.items-center.gap-4
        div.font-black.uppercase.tracking-wider(
          class="text-3xl sm:text-5xl"
          :class="gameResult === 'win' ? 'text-green-400' : 'text-red-400'"
        ) {{ resultText }}
        div.flex.items-center.gap-3
          svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-8 h-8 text-yellow-300")
            circle(cx="12" cy="12" r="10" fill="currentColor")
            text(x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#92400e") $
          span.text-yellow-400.font-black(class="text-2xl sm:text-4xl") +{{ rewardAmount }}

    //- Config Modal
    BaybladeConfigModal(
      v-model="configModalOpen"
      :initial-team="playerTeam"
      @save="onConfigSave"
    )
</template>

<style scoped lang="sass">
.animate-pulse
  animation: pulse 2s ease-in-out infinite

@keyframes pulse
  0%, 100%
    opacity: 1
  50%
    opacity: 0.5
</style>
