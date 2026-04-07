<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FIconButton from '@/components/atoms/FIconButton'
import FReward from '@/components/atoms/FReward'
import BaybladeConfigModal from '@/components/organisms/BaybladeConfigModal'
import OptionsModal from '@/components/organisms/OptionsModal'
import useSounds from '@/use/useSound'
import useBaybladeGame, { BLADE_RADIUS } from '@/use/useBaybladeGame'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import useBaybladeCampaign from '@/use/useBaybladeCampaign'
import { useHint } from '@/use/useHint'
import { useScreenshake } from '@/use/useScreenshake'
import type { BaybladeConfig } from '@/types/bayblade'
import useUser from '@/use/useUser'
import IconCoin from '@/components/icons/IconCoin.vue'
import DailyRewards from '@/components/organisms/DailyRewards.vue'
import FLogoProgress from '@/components/atoms/FLogoProgress.vue'
import { prependBaseUrl } from '@/utils/function'

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
  pixelToGame,
  spawnMeteorShower
} = useBaybladeGame()

const { playerTeam, coins, hasFirstWin, saveTeam, addCoins, markFirstWin } = useBaybladeConfig()
const { currentStage, currentStageId, isLastStage, playerUpgrades, advanceStage } = useBaybladeCampaign()
const { showHint, startHintTimer, clearHint } = useHint(5000)
const { shakeStyle } = useScreenshake()
const { t } = useI18n()
const { playSound } = useSounds()

const { setSettingValue } = useUser()

// ─── Canvas Refs ───────────────────────────────────────────────────────────

const canvasRef: Ref<HTMLCanvasElement | null> = ref(null)
const canvasSize: Ref<number> = ref(0)
const canvasWidth: Ref<number> = ref(0)
const canvasHeight: Ref<number> = ref(0)
const configModalOpen: Ref<boolean> = ref(false)
const showOptions: Ref<boolean> = ref(false)
const showDailyRewards: Ref<boolean> = ref(false)
const coinsAwarded: Ref<boolean> = ref(false)

// ─── NPC Team from Campaign Stage ─────────────────────────────────────────

const stageNpcTeam = (): BaybladeConfig[] =>
  currentStage.value.enemyTeam.map(e => ({
    topPartId: e.topPartId,
    bottomPartId: e.bottomPartId,
    topLevel: e.topLevel,
    bottomLevel: e.bottomLevel,
    modelId: e.modelId,
    isBoss: e.isBoss
  }))

/** Player team with current upgrade levels applied */
const playerTeamWithUpgrades = (): BaybladeConfig[] =>
  playerTeam.value.map(c => ({
    ...c,
    topLevel: playerUpgrades.value.tops[c.topPartId],
    bottomLevel: playerUpgrades.value.bottoms[c.bottomPartId]
  }))

// ─── Hint Timer ───────────────────────────────────────────────────────────

watch(phase, (p) => {
  if (p === 'player_turn') {
    startHintTimer()
  } else {
    clearHint()
  }
})

// ─── Computed ──────────────────────────────────────────────────────────────

const isGameOver = computed(() => phase.value === 'game_over')
const showReward: Ref<boolean> = ref(false)

const resultText = computed(() => {
  if (gameResult.value === 'win') return t('bayblade.youWin')
  if (gameResult.value === 'lose') return t('bayblade.youLose')
  return ''
})

const rewardAmount = computed(() =>
  gameResult.value === 'win' ? currentStage.value.rewardWin : currentStage.value.rewardLose
)

// Config button: only when game over and no new game started
const showConfigButton = computed(() =>
  phase.value === 'game_over' || phase.value === 'idle' || phase.value === 'tap_to_start'
)

const adRewardCoins = 100

// ─── Treasure Chest Cooldown ──────────────────────────────────────────────

const CHEST_COOLDOWN_MS = 10 * 60 * 1000
const CHEST_KEY = 'bayblade_chest_ready_at'
const CHEST_REWARD = 100

const chestReadyAt = ref(parseInt(localStorage.getItem(CHEST_KEY) || '0', 10))
const chestRemaining = ref(0)
let chestIntervalId: number | null = null

const chestReady = computed(() => chestRemaining.value <= 0)

const updateChestTimer = () => {
  // Re-read from localStorage so external resets (cheats) are picked up
  chestReadyAt.value = parseInt(localStorage.getItem(CHEST_KEY) || '0', 10)
  const now = Date.now()
  chestRemaining.value = Math.max(0, chestReadyAt.value - now)
}

const chestTimeDisplay = computed(() => {
  const totalSec = Math.ceil(chestRemaining.value / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const chestCooldownPct = computed(() =>
  chestRemaining.value / CHEST_COOLDOWN_MS
)

// ─── Coin Explosion VFX ───────────────────────────────────────────────────

const coinBadgeRef = ref<HTMLElement | null>(null)
const chestRef = ref<HTMLElement | null>(null)

const COIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px"><circle cx="12" cy="12" r="11" fill="black"/><circle cx="12" cy="12" r="10" fill="#fde047"/><text x="12" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="#2f920e">$</text></svg>'

const spawnCoinExplosion = () => {
  const chestEl = chestRef.value
  const badgeEl = coinBadgeRef.value
  if (!chestEl || !badgeEl) return

  const chestRect = chestEl.getBoundingClientRect()
  const cx = chestRect.left + chestRect.width / 2
  const cy = chestRect.top + chestRect.height / 2

  const count = 20
  const els: HTMLDivElement[] = []
  const angles: number[] = []
  const distances: number[] = []
  const staggerDelays: number[] = []

  const container = document.getElementById('app') || document.body

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.innerHTML = COIN_SVG
    el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:100;will-change:transform,opacity;'
    el.style.transform = `translate(${cx - 10}px,${cy - 10}px)`
    container.appendChild(el)
    els.push(el)
    angles.push(Math.random() * Math.PI * 2)
    distances.push(40 + Math.random() * 80)
    staggerDelays.push(Math.random() * 300)
  }

  const startTime = performance.now()
  const explodeDuration = 600
  const flyDuration = 500

  let flyStartPositions: { x: number; y: number }[] | null = null
  let tx = 0
  let ty = 0

  const animate = (now: number) => {
    const elapsed = now - startTime

    if (elapsed < explodeDuration) {
      const progress = elapsed / explodeDuration
      for (let i = 0; i < count; i++) {
        const x = cx - 10 + Math.cos(angles[i]!) * distances[i]! * progress
        const y = cy - 10 + Math.sin(angles[i]!) * distances[i]! * progress
        els[i]!.style.transform = `translate(${x}px,${y}px)`
      }
      requestAnimationFrame(animate)
    } else {
      if (!flyStartPositions) {
        const badgeRect = badgeEl.getBoundingClientRect()
        flyStartPositions = els.map((_, i) => ({
          x: cx - 10 + Math.cos(angles[i]!) * distances[i]!,
          y: cy - 10 + Math.sin(angles[i]!) * distances[i]!
        }))
        tx = badgeRect.left + badgeRect.width / 2 - 10
        ty = badgeRect.top + badgeRect.height / 2 - 10
      }

      const flyElapsed = elapsed - explodeDuration
      let allDone = true

      for (let i = 0; i < count; i++) {
        const localElapsed = flyElapsed - staggerDelays[i]!
        if (localElapsed < 0) {
          allDone = false
          continue
        }
        const t = Math.min(1, localElapsed / flyDuration)
        const ease = t * t
        const sx = flyStartPositions[i]!.x
        const sy = flyStartPositions[i]!.y
        const x = sx + (tx - sx) * ease
        const y = sy + (ty - sy) * ease
        els[i]!.style.transform = `translate(${x}px,${y}px)`
        els[i]!.style.opacity = String(1 - ease)
        if (t < 1) allDone = false
      }

      if (!allDone) {
        requestAnimationFrame(animate)
      } else {
        for (const el of els) el.remove()
      }
    }
  }
  requestAnimationFrame(animate)
}

const collectChest = () => {
  if (!chestReady.value) return
  addCoins(CHEST_REWARD)
  spawnCoinExplosion()
  chestReadyAt.value = Date.now() + CHEST_COOLDOWN_MS
  localStorage.setItem(CHEST_KEY, chestReadyAt.value.toString())
  updateChestTimer()
}


// ─── Canvas Sizing ─────────────────────────────────────────────────────────

const updateCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvasWidth.value = window.innerWidth
  canvasHeight.value = window.innerHeight
  canvasSize.value = Math.min(canvasWidth.value, canvasHeight.value)
  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value
}

// ─── Pointer Event Handlers ────────────────────────────────────────────────

const getGameCoords = (e: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return pixelToGame(
    e.clientX - rect.left,
    e.clientY - rect.top,
    canvasWidth.value,
    canvasHeight.value
  )
}

const onPointerDown = (e: PointerEvent) => {
  clearHint()
  if (phase.value === 'tap_to_start') {
    startMatch()
    return
  }
  const coords = getGameCoords(e)
  beginDrag(coords.x, coords.y)
}

const isHoveringBlade = (gameX: number, gameY: number): boolean => {
  if (phase.value !== 'player_turn') return false
  for (const blade of playerBlades.value) {
    if (blade.hp <= 0) continue
    const dx = gameX - blade.x
    const dy = gameY - blade.y
    if (Math.sqrt(dx * dx + dy * dy) < BLADE_RADIUS * 3) return true
  }
  return false
}

const onPointerMove = (e: PointerEvent) => {
  const coords = getGameCoords(e)
  if (isDragging.value) {
    updateDrag(coords.x, coords.y)
    canvasRef.value!.style.cursor = 'grabbing'
    return
  }
  canvasRef.value!.style.cursor = isHoveringBlade(coords.x, coords.y) ? 'grab' : ''
}

const onPointerUp = () => {
  if (!isDragging.value) return
  releaseDrag()
  if (canvasRef.value) canvasRef.value.style.cursor = ''
}

const onPointerLeave = () => {
  if (!isDragging.value) return
  forceReleaseDragAtMax()
  if (canvasRef.value) canvasRef.value.style.cursor = ''
}

// ─── Game Over ─────────────────────────────────────────────────────────────

watch(isGameOver, (over) => {
  if (over && !coinsAwarded.value) {
    playSound(gameResult.value === 'win' ? 'win' : 'lose')
    if (gameResult.value === 'win') spawnMeteorShower(80, 50, 65)
    addCoins(rewardAmount.value)
    if (gameResult.value === 'win') {
      if (!hasFirstWin.value) markFirstWin()
      advanceStage()
    }
    coinsAwarded.value = true
    showReward.value = true
  }
})

const onRewardContinue = () => {
  showReward.value = false
  coinsAwarded.value = false
  initGame(playerTeamWithUpgrades(), stageNpcTeam(), !hasFirstWin.value, currentStage.value.arenaType)
}

const onOpenConfig = () => {
  configModalOpen.value = true
}

const onConfigSave = (team: BaybladeConfig[]) => {
  saveTeam(team)
  initGame(playerTeamWithUpgrades(), stageNpcTeam(), !hasFirstWin.value, currentStage.value.arenaType)
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

let renderRafId: number | null = null

const renderLoop = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  render(ctx, canvasWidth.value, canvasHeight.value, showHint.value)
  renderRafId = requestAnimationFrame(renderLoop)
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)

  initGame(playerTeamWithUpgrades(), stageNpcTeam(), !hasFirstWin.value, currentStage.value.arenaType)
  renderRafId = requestAnimationFrame(renderLoop)

  updateChestTimer()
  chestIntervalId = window.setInterval(updateChestTimer, 1000)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  stopPhysics()
  if (renderRafId !== null) cancelAnimationFrame(renderRafId)
  if (chestIntervalId !== null) clearInterval(chestIntervalId)
})
</script>

<template lang="pug">
  div.arena.relative.w-screen.h-screen.overflow-hidden.flex.items-center.justify-center(
    class="bg-[#0d1117]"
    :style="shakeStyle"
  )
    //- Logo Preloader
    FLogoProgress

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

      //- Top bar: stage + coins
      div.flex.justify-between.items-start.p-3(class="sm:p-4")
        //- Stage indicator
        div.flex.items-center.gap-2.rounded-lg.text-white.font-bold(
          :class="[\
            'px-3 py-1.5 text-xs sm:text-sm',\
            currentStage.isBoss ? 'bg-red-900/90 border border-red-500/50'\
              : currentStage.arenaType === 'lava' ? 'bg-orange-900/90 border border-orange-500/50'\
              : currentStage.arenaType === 'ice' ? 'bg-cyan-900/90 border border-cyan-500/50'\
              : currentStage.arenaType === 'forest' ? 'bg-green-900/90 border border-green-500/50'\
              : currentStage.arenaType === 'thunder' ? 'bg-yellow-900/90 border border-yellow-500/50'\
              : 'bg-slate-700/80'\
          ]"
        )
          span.game-text(
            :class="currentStage.isBoss ? 'text-red-300' : ''"
          ) {{ currentStage.isBoss ? 'BOSS' : 'Stage' }} {{ currentStageId }}
          span.game-text(
            :class="[\
              'text-[10px] sm:text-xs',\
              currentStage.isBoss ? 'text-red-400'\
                : currentStage.arenaType === 'lava' ? 'text-orange-400'\
                : currentStage.arenaType === 'ice' ? 'text-cyan-400'\
                : currentStage.arenaType === 'forest' ? 'text-green-400'\
                : currentStage.arenaType === 'thunder' ? 'text-yellow-400'\
                : 'text-slate-400'\
            ]"
          ) {{ currentStage.name }}
        //- Coin counter + Chest
        div.flex.flex-col.items-end.gap-2
          div.flex.items-center.gap-2.rounded-lg.text-white.font-bold(
            ref="coinBadgeRef"
            class="px-3 py-1.5 bg-yellow-600/80 text-sm sm:text-base"
          )
            IconCoin(class="w-5 h-5 text-yellow-300")
            span.game-text {{ coins }}
          //- Treasure chest
          div.flex.flex-col.items-center.pointer-events-auto(
            @click="collectChest"
            :class="chestReady ? 'cursor-pointer animate-pulse' : ''"
          )
            div.relative(ref="chestRef" class="w-10 h-10 sm:w-12 sm:h-12")
              img.object-contain.w-full.h-full(
                src="/images/icons/chest_128x128.webp"
                :class="chestReady ? 'drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]' : ''"
              )
              //- Circular cooldown overlay
              svg.absolute.inset-0.w-full.h-full(
                v-if="!chestReady"
                viewBox="0 0 40 40"
                style="transform: rotate(-90deg) scaleX(-1)"
              )
                circle(
                  cx="20" cy="20" r="19"
                  fill="none"
                  stroke="rgba(0,0,0,0.55)"
                  stroke-width="40"
                  :stroke-dasharray="119.38"
                  :stroke-dashoffset="119.38 * (1 - chestCooldownPct)"
                )
            span.game-text.text-white.font-bold(
              class="text-[10px] sm:text-xs"
            ) {{ chestTimeDisplay }}

      //- Center overlay messages
      div.absolute.flex.items-center.justify-center(class="inset-0 z-[10]")

        //- Tap to Start
        div(
          v-if="phase === 'tap_to_start'"
          class="text-center pointer-events-auto cursor-pointer"
          @click="startMatch"
        )
          div.text-white.font-black.uppercase.tracking-wider.animate-pulse.game-text(
            class="text-3xl sm:text-5xl mb-2"
          ) Tap to Start
          div.text-white.italic.game-text(class="text-sm sm:text-lg opacity-60")
            | Click or tap the arena

        //- Turn Announcement
        div(
          v-else-if="phase === 'deciding_turn' && turnAnnouncement"
          class="text-center"
        )
          div.text-white.font-black.uppercase.tracking-wider.animate-pulse.game-text(
            class="text-2xl sm:text-4xl"
          ) {{ turnAnnouncement }}

        //- Player turn hint
        div(
          v-else-if="phase === 'player_turn'"
          class="absolute bottom-16 sm:bottom-20 text-center"
        )
          div.text-white.italic.game-text(class="text-xs sm:text-sm opacity-50")
            | Tap a blade, then drag to launch

      //- Bottom-left daily rewards button
      div(
        v-if="showConfigButton && !showReward && currentStageId >= 3"
        class="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-auto z-50"
        :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
      )
        button.group.cursor-pointer.z-10.transition-transform(
          class="hover:scale-[103%] active:scale-90 scale-80 sm:scale-110"
          @click="showDailyRewards = true"
        )
          div.relative
            div.absolute.inset-0.translate-y-1.rounded-lg(class="bg-[#1a2b4b]")
            div.relative.rounded-lg.border-2.text-white.font-bold.flex.flex-col.items-center.px-3.py-1(
              class="bg-gradient-to-b from-[#ffcd00] to-[#f7a000] border-[#0f1a30]"
            )
              span.font-black.game-text.leading-tight(class="text-[10px] sm:text-xs") +100
              IconCoin(class="w-5 h-5 text-yellow-300")

      //- Bottom-right buttons (always visible when not in reward overlay)
      div(
        v-if="showConfigButton && !showReward"
        class="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-auto z-50 flex gap-2 items-end"
        :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
      )
        //- Ad reward button
        button.group.cursor-pointer.z-10.transition-transform(
          v-if="currentStageId >= 3"
          class="hover:scale-[103%] active:scale-90 scale-80 sm:scale-110"
        )
          div.relative
            div.absolute.inset-0.translate-y-1.rounded-lg(class="bg-[#1a2b4b]")
            div.relative.rounded-lg.border-2.text-white.font-bold.flex.flex-col.items-center.px-2.py-1(
              class="bg-gradient-to-b from-[#ffcd00] to-[#f7a000] border-[#0f1a30]"
            )
              div.flex.items-center.gap-1
                span.font-black.game-text.leading-tight(class="text-[10px] sm:text-xs") +{{ adRewardCoins }}
                IconCoin.inline(class="w-4 h-4 text-yellow-300")
              img.object-contain(
                src="/images/icons/movie_128x96.webp"
                class="h-7 w-7 sm:h-8 sm:w-8"
              )

        FIconButton(
          type="secondary"
          size="lg"
          :img-src="prependBaseUrl('images/icons/gears_128x128.webp')"
          @click="showOptions = true"
        )
        FIconButton(
          v-if="hasFirstWin"
          type="secondary"
          size="lg"
          :img-src="prependBaseUrl('images/icons/team_128x128.webp')"
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
        div.font-black.uppercase.tracking-wider.game-text(
          class="text-3xl sm:text-5xl"
          :class="gameResult === 'win' ? 'text-green-400' : 'text-red-400'"
        ) {{ resultText }}
        div.flex.items-center.gap-3
          IconCoin(class="w-8 h-8 text-yellow-300")
          span.text-yellow-400.font-black.game-text(class="text-2xl sm:text-4xl") +{{ rewardAmount }}

    //- Options Modal
    OptionsModal(
      :is-open="showOptions"
      @close="showOptions = false"
    )

    //- Config Modal
    BaybladeConfigModal(
      v-model="configModalOpen"
      :initial-team="playerTeam"
      @save="onConfigSave"
    )

    //- Daily Rewards Modal
    DailyRewards(
      v-model="showDailyRewards"
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
