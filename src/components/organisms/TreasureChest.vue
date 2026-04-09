<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import useSounds from '@/use/useSound.ts'

interface Props {
  /** Element where the coin explosion VFX should fly to (e.g. the coin badge). */
  targetEl?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  targetEl: null
})

const { addCoins } = useBaybladeConfig()

// ─── Cooldown State ──────────────────────────────────────────────────────────

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

// ─── Coin Explosion VFX ──────────────────────────────────────────────────────

const chestRef = ref<HTMLElement | null>(null)

const COIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px"><circle cx="12" cy="12" r="11" fill="black"/><circle cx="12" cy="12" r="10" fill="#fde047"/><text x="12" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="#2f920e">$</text></svg>'

const spawnCoinExplosion = () => {
  const chestEl = chestRef.value
  const badgeEl = props.targetEl
  if (!chestEl || !badgeEl) return

  const chestRect = chestEl.getBoundingClientRect()
  const cx = chestRect.left + chestRect.width / 2
  const cy = chestRect.top + chestRect.height / 2

  const count = 20
  const els: HTMLDivElement[] = []
  const angles: number[] = []
  const distances: number[] = []
  const staggerDelays: number[] = []

  const { playSound } = useSounds()
  playSound('happy')

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

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  updateChestTimer()
  chestIntervalId = window.setInterval(updateChestTimer, 1000)
})

onUnmounted(() => {
  if (chestIntervalId !== null) clearInterval(chestIntervalId)
})
</script>

<template lang="pug">
  div.flex.flex-col.items-center.pointer-events-auto(
    @click="collectChest"
    :class="chestReady ? 'cursor-pointer chest-pulse' : ''"
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
</template>

<style scoped lang="sass">
.chest-pulse
  animation: chest-pulse 2s ease-in-out infinite

@keyframes chest-pulse
  0%, 100%
    opacity: 1
  50%
    opacity: 0.5
</style>
