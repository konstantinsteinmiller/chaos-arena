<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FIconButton from '@/components/atoms/FIconButton'
import FReward from '@/components/atoms/FReward'
import BaybladeConfigModal from '@/components/organisms/BaybladeConfigModal'
import OptionsModal from '@/components/organisms/OptionsModal'
import useSounds from '@/use/useSound'
import useBaybladeGame, { BLADE_RADIUS, simSpeed, countdownText } from '@/use/useBaybladeGame'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import useBaybladeCampaign from '@/use/useBaybladeCampaign'
import { useHint } from '@/use/useHint'
import { useScreenshake } from '@/use/useScreenshake'
import type { BaybladeConfig } from '@/types/bayblade'
import useUser, { isMobileLandscape, isMobilePortrait } from '@/use/useUser'
import IconCoin from '@/components/icons/IconCoin.vue'
import DailyRewards from '@/components/organisms/DailyRewards.vue'
import TreasureChest from '@/components/organisms/TreasureChest.vue'
import AdRewardButton from '@/components/organisms/AdRewardButton.vue'
import CoinBadge from '@/components/organisms/CoinBadge.vue'
import FLogoProgress from '@/components/atoms/FLogoProgress.vue'
import { prependBaseUrl } from '@/utils/function'
import FMuteButton from '@/components/atoms/FMuteButton.vue'
import FButtonSwitch from '@/components/atoms/FButtonSwitch.vue'
import StageBadge from '@/components/StageBadge.vue'
import FakeLeaderBoard from '@/components/organisms/FakeLeaderBoard.vue'
import useLeaderboard, { type LeaderboardEntry } from '@/use/useLeaderboard'
import { isCrazySDKIntegrated } from '@/use/useMatch.ts'
import useBottomSafe from '@/use/useBottomSafe'

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

const { playerTeam, hasFirstWin, saveTeam, addCoins, markFirstWin } = useBaybladeConfig()
const { currentStage, currentStageId, isLastStage, playerUpgrades, advanceStage } = useBaybladeCampaign()
const { recordPlayerStage, markGhostFought } = useLeaderboard()
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
const coinsAwarded: Ref<boolean> = ref(false)

// ─── Ghost Fight (Leaderboard 1v1) ────────────────────────────────────────
// While true, the current match is a ghost battle launched from the
// leaderboard: rewards are custom, campaign progress does not advance,
// the StageBadge is hidden, and the arena uses the default theme.
const ghostMode: Ref<boolean> = ref(false)
const ghostEnemy: Ref<LeaderboardEntry | null> = ref(null)

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

const rewardAmount = computed(() => {
  if (ghostMode.value) {
    if (gameResult.value !== 'win') return 0
    const enemyStage = ghostEnemy.value?.maxStage ?? 1
    const base = 50 + enemyStage * 2
    // Diminish to 60% if the opponent is significantly weaker than the player
    if (currentStageId.value - enemyStage >= 5) return Math.round(base * 0.6)
    return base
  }
  return gameResult.value === 'win' ? currentStage.value.rewardWin : currentStage.value.rewardLose
})

// Config button: only when game over and no new game started
const showConfigButton = computed(() =>
  phase.value === 'game_over' || phase.value === 'idle' || phase.value === 'tap_to_start'
)

const adRewardCoins = 100

// ─── 2x Simulation Speed Boost ────────────────────────────────────────────

// Players can watch a rewarded video to unlock a temporary 2x speed-up.
// The boost is purely visual — physics integration runs twice per frame
// while active, so collisions and damage are unaffected.
const SPEED_BOOST_KEY = 'bayblade_2x_expires_at'
const SPEED_BOOST_DURATION_MS = 3 * 60 * 1000

const speedBoostExpiresAt: Ref<number> = ref(parseInt(localStorage.getItem(SPEED_BOOST_KEY) || '0', 10))
const speedNow: Ref<number> = ref(Date.now())

const is2xAvailable = computed(() => speedNow.value < speedBoostExpiresAt.value)

const updateSpeedBoost = () => {
  speedNow.value = Date.now()
  // Auto-revert to 1x once the boost runs out
  if (simSpeed.value === 2 && speedNow.value >= speedBoostExpiresAt.value) {
    simSpeed.value = 1
  }
}

const onSpeedSwitchClick = (value: 1 | 2) => {
  if (value === 1) {
    simSpeed.value = 1
    return
  }
  if (is2xAvailable.value) {
    simSpeed.value = 2
    return
  }
  triggerSpeedBoostAd()
}

// Triggers the rewarded video ad. Stub: integrate the ad SDK here.
// On successful video completion, call the snippet documented below to
// unlock 2x for SPEED_BOOST_DURATION_MS:
//   speedBoostExpiresAt.value = Date.now() + SPEED_BOOST_DURATION_MS
//   localStorage.setItem(SPEED_BOOST_KEY, String(speedBoostExpiresAt.value))
//   simSpeed.value = 2
const triggerSpeedBoostAd = () => {
  // TODO: integrate rewarded video ad SDK
}

// Reference to the CoinBadge component — TreasureChest reads its `rootEl`
// for the fly-to-badge VFX target.
const coinBadgeRef = ref<{ rootEl: HTMLElement | null } | null>(null)
const coinBadgeEl = computed(() => coinBadgeRef.value?.rootEl ?? null)

let speedBoostIntervalId: number | null = null

// ─── Canvas Sizing ─────────────────────────────────────────────────────────

const updateCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  // visualViewport reflects the *currently visible* area on mobile (i.e. it
  // shrinks while the URL bar is showing) — fall back to innerHeight where
  // it isn't supported. This keeps the canvas/physics bounds aligned with
  // what the user actually sees and prevents bottom-row buttons from being
  // hidden behind the browser chrome.
  const vv = window.visualViewport
  canvasWidth.value = vv?.width ?? window.innerWidth
  canvasHeight.value = vv?.height ?? window.innerHeight
  canvasSize.value = Math.min(canvasWidth.value, canvasHeight.value)
  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value
}

// ─── Bottom-Row Visibility Guard ──────────────────────────────────────────
//
// `useBottomSafe` computes the gap between the layout viewport and the
// actually-visible visual viewport (i.e. the strip hidden behind URL bar /
// browser chrome on Android Chrome and Safari). The shared `bottomGapPx`
// pixel value is consumed by every bottom-anchored element so they all stay
// in sync. We deliberately do NOT re-measure on phase change — the value
// only depends on viewport metrics, not on which buttons are mounted.

const { bottomGapPx, scheduleBottomMeasure } = useBottomSafe()

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
    if (gameResult.value === 'win' && !ghostMode.value) {
      if (!hasFirstWin.value) markFirstWin()
      advanceStage()
      recordPlayerStage(currentStageId.value)
    }
    coinsAwarded.value = true
    showReward.value = true
  }
})

const onRewardContinue = () => {
  showReward.value = false
  coinsAwarded.value = false
  // Exiting a ghost fight: drop ghost state and return to the campaign stage
  if (ghostMode.value) {
    ghostMode.value = false
    ghostEnemy.value = null
  }
  initGame(playerTeamWithUpgrades(), stageNpcTeam(), !hasFirstWin.value, currentStage.value.arenaType)
}

// ─── Leaderboard / Ghost Fight ────────────────────────────────────────────

const onGhostFight = (entry: LeaderboardEntry) => {
  ghostEnemy.value = entry
  ghostMode.value = true
  markGhostFought(entry.id)
  const playerLead = playerTeamWithUpgrades()[0]
  if (!playerLead) return
  const ghostBlade: BaybladeConfig = {
    topPartId: entry.blade.topPartId,
    bottomPartId: entry.blade.bottomPartId,
    topLevel: entry.blade.topLevel ?? 0,
    bottomLevel: entry.blade.bottomLevel ?? 0,
    modelId: entry.blade.modelId
  }
  initGame([playerLead], [ghostBlade], false, 'default')
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

const onViewportChange = () => {
  updateCanvasSize()
  scheduleBottomMeasure()
}

onMounted(() => {
  updateCanvasSize()
  scheduleBottomMeasure()
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('orientationchange', onViewportChange)
  window.visualViewport?.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('scroll', onViewportChange)

  initGame(playerTeamWithUpgrades(), stageNpcTeam(), !hasFirstWin.value, currentStage.value.arenaType)
  renderRafId = requestAnimationFrame(renderLoop)

  recordPlayerStage(currentStageId.value)

  updateSpeedBoost()
  speedBoostIntervalId = window.setInterval(updateSpeedBoost, 1000)
})

onUnmounted(() => {
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('orientationchange', onViewportChange)
  window.visualViewport?.removeEventListener('resize', onViewportChange)
  window.visualViewport?.removeEventListener('scroll', onViewportChange)
  stopPhysics()
  if (renderRafId !== null) cancelAnimationFrame(renderRafId)
  if (speedBoostIntervalId !== null) clearInterval(speedBoostIntervalId)
  // Always leave the arena at normal speed so other views aren't affected
  simSpeed.value = 1
})
</script>

<template lang="pug">
  div.arena.relative.w-screen.overflow-hidden.flex.items-center.justify-center(
    class="bg-[#0d1117] h-screen h-dvh"
  )
    //- Logo Preloader
    FLogoProgress

    //- Game Canvas
    //- Screen-shake transform lives ONLY on the canvas, not on .arena, so
    //- the HUD's `position: fixed` buttons stay anchored to the real viewport.
    //- Putting a `transform` on .arena would promote it to a containing block
    //- for fixed descendants, and `overflow-hidden` would then clip them.
    canvas(
      ref="canvasRef"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerLeave"
      @pointerleave="onPointerLeave"
      class="block touch-none"
      :style="shakeStyle"
    )

    //- HUD Overlay
    div.absolute.inset-0.pointer-events-none

      //- Top bar: stage + coins
      //- safe-area-inset-* keeps the row clear of the iPhone notch /
      //- Dynamic Island and (in landscape) the side cutouts when running as
      //- a standalone PWA with viewport-fit=cover.
      div.flex.justify-between.items-start(
        class="p-2 sm:p-2"
        :style="{\
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',\
          paddingLeft: 'calc(0.5rem + env(safe-area-inset-left, 0px))',\
          paddingRight: 'calc(0.5rem + env(safe-area-inset-right, 0px))'\
        }"
      )
        //- Stage indicator (fancy themed badge) — hidden during a ghost fight
        StageBadge(
          v-if="!ghostMode"
          :stage-id="currentStageId"
          :name="currentStage.name"
          :is-boss="currentStage.isBoss"
          :arena-type="currentStage.arenaType"
        )
        //- Spacer to keep coins right-aligned when StageBadge is hidden
        div(v-else)
        //- Coin counter + Chest
        div.flex.flex-col.items-end.gap-2
          CoinBadge(ref="coinBadgeRef")
          //- Treasure chest (cooldown + collect logic + VFX, fully self-contained)
          TreasureChest(:target-el="coinBadgeEl")

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

        //- Every-10th-game countdown — rendered inside the meteor shower ring
        div(
          v-else-if="phase === 'meteor_intro' && countdownText"
          class="text-center"
        )
          div.countdown-number.font-black.game-text.text-white(
            :key="countdownText"
            class="text-7xl sm:text-9xl"
          ) {{ countdownText }}

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
          class="absolute text-center"
          :style="{ bottom: `calc(4rem + env(safe-area-inset-bottom, 0px) + ${bottomGapPx}px)` }"
        )
          div.text-white.italic.game-text(class="text-xs sm:text-sm opacity-50")
            | Tap a blade, then drag to launch

      //- Bottom-left daily rewards (button + modal, fully self-contained)
      DailyRewards(v-if="showConfigButton && !showReward && currentStageId >= 3")
      FMuteButton(
        v-if="showConfigButton"
        class="fixed"
        :style="{\
          bottom: `calc(4.5rem + env(safe-area-inset-bottom, 0px) + ${bottomGapPx}px)`,\
          left: 'calc(0.5rem + env(safe-area-inset-left, 0px))'\
        }"
      )

      //- Bottom-right buttons (always visible when not in reward overlay)
      div(
        v-if="showConfigButton && !showReward"
        class="fixed pointer-events-auto z-50 flex gap-2 items-end"
        :style="{\
          bottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px) + ${bottomGapPx}px)`,\
          right: 'calc(0.5rem + env(safe-area-inset-right, 0px))'\
        }"
      )
        //- Ad reward button (rewarded video → coins, fully self-contained)
        AdRewardButton(
          v-if="currentStageId >= 3"
          :coins="adRewardCoins"
        )

        //- Fake leaderboard (button + paginated modal, fully self-contained)
        FakeLeaderBoard(
          v-if="currentStageId >= 5 && !ghostMode"
          @fight="onGhostFight"
        )

        FIconButton(
          type="secondary"
          size="md"
          :img-src="prependBaseUrl('images/icons/gears_128x128.webp')"
          @click="showOptions = true"
        )
        //- Speed switch (above team config) + team config button column
        div.flex.flex-col.items-center.gap-2
          FButtonSwitch.speedup-switch.scale-90(
            v-if="isCrazySDKIntegrated"
            class="sm:scale-100"
            :model-value="simSpeed"
            :options="[{ value: 1 }, { value: 2 }]"
            @click="onSpeedSwitchClick"
          )
            template(#default="{ option }") {{ option.value }}x
            template(#hint="{ option }")
              //- Movie hint icon — only under the 2x button when boost not yet earned
              img.absolute.object-contain.pointer-events-none(
                v-if="option.value === 2 && simSpeed === 1 && !is2xAvailable"
                src="/images/icons/movie_128x96.webp"
                class="right-0 top-1/2 -translate-y-[50%] h-3 w-3 mr-1.5"
              )
          FIconButton(
            v-if="hasFirstWin || currentStageId >= 2"
            type="secondary"
            size="md"
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
        span.text-white.font-black.uppercase.italic.game-text(class="sm:text-2xl" :class="{ 'sm:text-2xl': !isMobileLandscape && !isMobilePortrait }") {{ t('bayblade.rewards') }}
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

</template>

<style scoped lang="sass">
.speedup-switch
  :deep(.button-wrap:last-of-type button)
    margin-right: 0.5rem

.animate-pulse
  animation: pulse 2s ease-in-out infinite
@keyframes pulse
  0%, 100%
    opacity: 1
  50%
    opacity: 0.5


.countdown-number
  display: inline-block
  text-shadow: 0 0 24px rgba(255, 200, 0, 0.85), 0 0 6px rgba(255, 255, 255, 0.6), 0 4px 0 #000
  animation: countdown-pop 375ms ease-out forwards
  will-change: transform, opacity

@keyframes countdown-pop
  0%
    transform: scale(0.4)
    opacity: 0
  20%
    transform: scale(1)
    opacity: 1
  100%
    transform: scale(2.6)
    opacity: 0

</style>
