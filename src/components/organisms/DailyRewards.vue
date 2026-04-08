<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FModal from '@/components/molecules/FModal'
import FIconButton from '@/components/atoms/FIconButton.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import useBaybladeConfig from '@/use/useBaybladeConfig'

const { addCoins } = useBaybladeConfig()

// ─── Daily Rewards Config ────────────────────────────────────────────────────

const DAILY_REWARDS = [100, 200, 300, 400, 500, 750, 1000]
const STORAGE_KEY = 'bayblade_daily_rewards'

interface DailyState {
  /** Index of the next reward to collect (0-6) */
  currentDay: number
  /** ISO date string of the last collection */
  lastCollected: string | null
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

// Re-evaluate streak break whenever the modal opens
watch(isModalOpen, (open) => {
  if (!open) return
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
})

const collectedToday = computed(() => state.value.lastCollected === todayStr())

// True whenever there is a reward ready to collect (drives the bouncing hint
// on the open-modal button).
const hasDailyRewardReady = computed(() => !collectedToday.value)

const collect = (dayIndex: number) => {
  if (dayIndex !== state.value.currentDay) return
  if (collectedToday.value) return

  addCoins(DAILY_REWARDS[dayIndex]!)
  const nextDay = dayIndex + 1 >= DAILY_REWARDS.length ? 0 : dayIndex + 1
  state.value = {
    currentDay: nextDay,
    lastCollected: todayStr()
  }
  saveState(state.value)
}
</script>

<template lang="pug">
  //- Bottom-left open-modal button
  div.daily-rewards.fixed.bottom-2.left-2(
    class="sm:bottom-3 sm:left-3 pointer-events-auto z-50"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
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
          span.font-black.game-text.leading-tight(class="text-[10px] sm:text-xs") +100
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
                ? 'bg-yellow-900/40 border-yellow-400' \
                : 'bg-slate-700/50 border-slate-600'\
          ]"
        )
          //- Day label
          div.text-gray-300.font-bold.uppercase(class="text-[8px] sm:text-[10px]") D{{ i + 1 }}

          //- Coin icon
          IconCoin(class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 my-0.5")

          //- Reward amount
          div.text-yellow-400.font-black.game-text(class="text-[9px] sm:text-xs") {{ reward }}

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
