<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FModal from '@/components/molecules/FModal'
import FIconButton from '@/components/atoms/FIconButton.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import useBottomSafe from '@/use/useBottomSafe'
import {
  SKINS_PER_TOP,
  MODEL_LABELS,
  isSkinOwned,
  buySkin,
  modelImgPath,
  type BaybladeModelId
} from '@/use/useModels'
import type { TopPartId } from '@/types/bayblade'

const { addCoins } = useBaybladeConfig()
const { bottomGapPx } = useBottomSafe()

// ─── Daily Rewards Config ────────────────────────────────────────────────────

const DAILY_REWARDS = [100, 200, 300, 400, 500, 750, 1000]
// Day indices (0-based) on which the reward is a skin unlock instead of coins.
// Covers day 3, 5, and 7.
const SKIN_REWARD_DAYS = new Set<number>([2, 4, 6])
const STORAGE_KEY = 'bayblade_daily_rewards'

const isSkinDay = (dayIndex: number) => SKIN_REWARD_DAYS.has(dayIndex)

interface DailyState {
  /** Index of the next reward to collect (0-6) */
  currentDay: number
  /** ISO date string of the last collection */
  lastCollected: string | null
}

// ─── Skin Pool Helpers ──────────────────────────────────────────────────────

/** Distinct model ids that still have at least one unowned top-part mapping. */
const unownedSkinModelIds = (): BaybladeModelId[] => {
  const result: BaybladeModelId[] = []
  const seen = new Set<string>()
  for (const topPartId of Object.keys(SKINS_PER_TOP) as TopPartId[]) {
    for (const modelId of SKINS_PER_TOP[topPartId]) {
      if (seen.has(modelId)) continue
      if (!isSkinOwned(topPartId, modelId)) {
        result.push(modelId)
        seen.add(modelId)
      }
    }
  }
  return result
}

const pickRandom = <T, >(arr: T[]): T | null =>
  arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)]! : null

/** Unlock a skin for every top part whose catalog contains it. */
const unlockSkinEverywhere = (modelId: BaybladeModelId) => {
  for (const topPartId of Object.keys(SKINS_PER_TOP) as TopPartId[]) {
    if (SKINS_PER_TOP[topPartId].includes(modelId)) {
      buySkin(topPartId, modelId)
    }
  }
}

const loadState = (): DailyState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.currentDay === 'number') return parsed
    }
  } catch { /* fall through */
  }
  return { currentDay: 0, lastCollected: null }
}

const saveState = (state: DailyState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const yesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ─── Reactive State ──────────────────────────────────────────────────────────

const state = ref<DailyState>(loadState())
const isModalOpen = ref(false)

// Per-day skin previews. Each skin day (3/5/7) is assigned a *distinct*
// model id drawn without replacement from the unowned pool, so no two cards
// ever advertise the same skin. Ephemeral — refreshed each time the modal
// opens so the preview always reflects the latest ownership state.
const offeredSkins = ref<Record<number, BaybladeModelId | null>>({})

const shuffled = <T, >(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Sample `count` distinct items from `pool` without replacement. */
const sampleDistinct = <T, >(pool: T[], count: number): T[] =>
  shuffled(pool).slice(0, count)

const refreshOfferedSkins = () => {
  const days = Array.from(SKIN_REWARD_DAYS).sort((a, b) => a - b)
  const picks = sampleDistinct(unownedSkinModelIds(), days.length)
  const result: Record<number, BaybladeModelId | null> = {}
  days.forEach((d, idx) => {
    result[d] = picks[idx] ?? null
  })
  offeredSkins.value = result
}

// Re-evaluate streak break whenever the modal opens
watch(isModalOpen, (open) => {
  if (!open) {
    offeredSkins.value = {}
    return
  }
  const s = loadState()
  const today = todayStr()
  const yesterday = yesterdayStr()

  if (s.lastCollected && s.lastCollected !== today && s.lastCollected !== yesterday) {
    // Missed a day — reset streak
    s.currentDay = 0
    s.lastCollected = null
    saveState(s)
  }
  state.value = s
  refreshOfferedSkins()
})

const collectedToday = computed(() => state.value.lastCollected === todayStr())

// True whenever there is a reward ready to collect (drives the bouncing hint
// on the open-modal button).
const hasDailyRewardReady = computed(() => !collectedToday.value)

const collect = (dayIndex: number) => {
  if (dayIndex !== state.value.currentDay) return
  if (collectedToday.value) return

  // Coin reward is always granted, on every day (skin days are additive).
  addCoins(DAILY_REWARDS[dayIndex]!)

  if (isSkinDay(dayIndex)) {
    // Re-resolve the pool at collect time to avoid handing out an already-owned
    // skin if something else unlocked it while the modal was open. Exclude
    // skins already promised to other skin days so the assignments stay
    // mutually distinct.
    const reservedByOtherDays = new Set(
      Object.entries(offeredSkins.value)
        .filter(([d, v]) => Number(d) !== dayIndex && v)
        .map(([, v]) => v as BaybladeModelId)
    )
    const pool = unownedSkinModelIds().filter(m => !reservedByOtherDays.has(m))
    // Prefer the previewed skin if it's still unowned, otherwise roll again.
    const preview = offeredSkins.value[dayIndex]
    const toUnlock: BaybladeModelId | null =
      preview && pool.includes(preview) ? preview : pickRandom(pool)
    if (toUnlock) {
      unlockSkinEverywhere(toUnlock)
    }
    // If the pool was empty, the coin reward above already covered the slot.
  }

  const nextDay = dayIndex + 1 >= DAILY_REWARDS.length ? 0 : dayIndex + 1
  state.value = {
    currentDay: nextDay,
    lastCollected: todayStr()
  }
  saveState(state.value)
  // Repopulate previews for whichever day is now current.
  refreshOfferedSkins()
}
</script>

<template lang="pug">
  //- Bottom-left open-modal button
  div.daily-rewards.fixed(
    class="pointer-events-auto z-50"
    :style="{\
      bottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px) + ${bottomGapPx}px)`,\
      left: 'calc(0.5rem + env(safe-area-inset-left, 0px))'\
    }"
  )
    button.group.cursor-pointer.z-10.transition-transform(
      class="hover:scale-[103%] active:scale-90 scale-80 sm:scale-110"
      :class="{ 'hint-bounce': hasDailyRewardReady }"
      @click="isModalOpen = true"
    )
      div.relative
        div.absolute.inset-0.translate-y-1.rounded-lg(class="bg-[#1a2b4b]")
        div.relative.rounded-lg.border-2.text-white.font-bold.flex.flex-col.items-center.px-3.py-1(
          class="bg-gradient-to-b from-[#ffcd00] to-[#f7a000] border-[#0f1a30]"
        )
          span.font-black.game-text.leading-tight(class="text-[10px] sm:text-xs") +{{ DAILY_REWARDS[state.currentDay] }}
          IconCoin(class="w-5 h-5 text-yellow-300")

  //- Daily Rewards Modal
  FModal(
    v-model="isModalOpen"
    :is-closable="true"
    title="Daily Rewards"
  )
    div(class="space-y-3 px-1 sm:px-3 py-2")
      div.grid.grid-cols-7.gap-1(class="sm:gap-2")
        div(
          v-for="(reward, i) in DAILY_REWARDS"
          :key="i"
          class="flex flex-col items-center rounded-xl p-1 sm:p-2 border-2 transition-all"
          :class="[\
            i < state.currentDay \
              ? 'bg-green-900/40 border-green-500/50' \
              : i === state.currentDay \
                ? (isSkinDay(i) ? 'bg-purple-900/40 border-purple-400' : 'bg-yellow-900/40 border-yellow-400') \
                : (isSkinDay(i) ? 'bg-purple-900/20 border-purple-700/60' : 'bg-slate-700/50 border-slate-600')\
          ]"
        )
          //- Day label
          div.text-gray-300.font-bold.uppercase(class="text-[8px] sm:text-[10px]") D{{ i + 1 }}

          //- Reward icon — skin image on skin days, coin on all others
          template(v-if="isSkinDay(i) && offeredSkins[i]")
            //- Whiteish radial halo behind the skin so dark models (snake,
            //- scorpion, shell, etc.) stay readable on the dark modal bg.
            div.skin-thumb-wrap.relative.flex.items-center.justify-center(
              class="w-6 h-6 sm:w-8 sm:h-8 my-0.5"
            )
              div.absolute.inset-0.rounded-full.pointer-events-none.skin-thumb-halo
              img(
                :src="modelImgPath(offeredSkins[i])"
                class="relative w-full h-full object-contain"
                :class="{ 'opacity-80': i !== state.currentDay }"
              )
          template(v-else)
            IconCoin(class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 my-0.5")

          //- Skin label (only when a skin is actually offered for this day)
          div.font-black.game-text.text-purple-300.uppercase.tracking-wider.leading-tight(
            v-if="isSkinDay(i) && offeredSkins[i]"
            class="text-[8px] sm:text-[10px]"
          ) {{ MODEL_LABELS[offeredSkins[i]] }}

          //- Coin reward amount — shown on every day (additive on skin days)
          div.text-yellow-400.font-black.game-text.leading-tight(class="text-[9px] sm:text-xs") +{{ reward }}

          //- Status
          div(class="mt-0.5 text-[8px] sm:text-[10px] font-bold")
            span.text-green-400(v-if="i < state.currentDay") ✓
            template(v-else-if="i === state.currentDay")
              FIconButton(
                v-if="!collectedToday"
                type="primary"
                size="sm"
                icon="right"
                @click="collect(i)"
              )
              span.text-yellow-300(v-else) ✓
            span.text-slate-500(v-else) —

      //- Footer info
      div.text-center(class="text-[10px] sm:text-xs text-slate-400")
        template(v-if="collectedToday")
          | Come back tomorrow for your next reward!
        template(v-else)
          | Collect today's reward! Don't miss a day or progress resets.
</template>

<style scoped lang="sass">
// Soft whiteish halo that sits behind skin thumbnails so dark models
// (snake, scorpion, shell, etc.) stay readable on the dark modal background.
.skin-thumb-halo
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.28) 35%, rgba(255, 255, 255, 0) 75%)
  filter: blur(4px)
  transform: scale(1.15)
</style>
