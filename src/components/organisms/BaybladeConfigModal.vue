<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import FModal from '@/components/molecules/FModal'
import type { BaybladeConfig, TopPartId, BottomPartId } from '@/types/bayblade'
import type { TabOption } from '@/components/atoms/FTabs'
import {
  TOP_PARTS_LIST,
  BOTTOM_PARTS_LIST,
  computeStats
} from '@/use/useBaybladeConfig'
import useBaybladeConfig from '@/use/useBaybladeConfig'
import useBaybladeCampaign, { upgradeCost, TOP_UPGRADE_BONUS, BOTTOM_UPGRADE_BONUS } from '@/use/useBaybladeCampaign'

interface Props {
  modelValue: boolean
  initialTeam?: BaybladeConfig[]
}

const props = withDefaults(defineProps<Props>(), {
  initialTeam: () => [
    { topPartId: 'star' as TopPartId, bottomPartId: 'balanced' as BottomPartId },
    { topPartId: 'round' as TopPartId, bottomPartId: 'balanced' as BottomPartId }
  ]
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', team: BaybladeConfig[]): void
}>()

// ─── Blade Selector (which blade are we configuring) ───────────────────────

const activeBladeIndex: Ref<string | number> = ref(0)

const bladeTabs = computed<TabOption[]>(() =>
  props.initialTeam.map((_, i) => ({
    label: `Blade ${i + 1}`,
    value: i
  }))
)

// ─── Per-Blade Configs (local editable copies) ────────────────────────────

const localTeam: Ref<BaybladeConfig[]> = ref([])

// Sync only when modal opens (not on every prop change, which would reset the tab)
watch(() => props.modelValue, (open) => {
  if (open) {
    localTeam.value = props.initialTeam.map(c => ({ ...c }))
    activeBladeIndex.value = 0
  }
}, { immediate: true })

// ─── Current Blade Being Edited ────────────────────────────────────────────

const currentConfig = computed(() =>
  localTeam.value[activeBladeIndex.value as number] ?? localTeam.value[0]
)

const { coins, addCoins } = useBaybladeConfig()
const { playerUpgrades, upgradeTop, upgradeBottom } = useBaybladeCampaign()

const topLevel = (id: TopPartId) => playerUpgrades.value.tops[id]
const bottomLevel = (id: BottomPartId) => playerUpgrades.value.bottoms[id]

const stats = computed(() => {
  const cfg = currentConfig.value
  return computeStats(cfg, topLevel(cfg.topPartId), bottomLevel(cfg.bottomPartId))
})

const buyTopUpgrade = (id: TopPartId) => {
  const cost = upgradeCost(topLevel(id) + 1)
  if (coins.value < cost) return
  addCoins(-cost)
  upgradeTop(id)
}

const buyBottomUpgrade = (id: BottomPartId) => {
  const cost = upgradeCost(bottomLevel(id) + 1)
  if (coins.value < cost) return
  addCoins(-cost)
  upgradeBottom(id)
}

// Upgraded stat values for display
const topDamage = (part: typeof TOP_PARTS_LIST[number]) =>
  (part.damageMultiplier + TOP_UPGRADE_BONUS[part.id].damage * topLevel(part.id)).toFixed(2)

const topDefense = (part: typeof TOP_PARTS_LIST[number]) =>
  (part.defenseMultiplier + TOP_UPGRADE_BONUS[part.id].defense * topLevel(part.id)).toFixed(2)

const topHp = (part: typeof TOP_PARTS_LIST[number]) =>
  part.healthBonus + TOP_UPGRADE_BONUS[part.id].hp * topLevel(part.id)

const bottomSpeed = (part: typeof BOTTOM_PARTS_LIST[number]) =>
  (part.speedMultiplier + BOTTOM_UPGRADE_BONUS[part.id].speed * bottomLevel(part.id)).toFixed(2)

const bottomHp = (part: typeof BOTTOM_PARTS_LIST[number]) =>
  part.healthBonus + BOTTOM_UPGRADE_BONUS[part.id].hp * bottomLevel(part.id)

const setTop = (id: TopPartId) => {
  const idx = activeBladeIndex.value as number
  localTeam.value[idx] = { ...localTeam.value[idx], topPartId: id }
  emit('save', localTeam.value.map(c => ({ ...c })))
}

const setBottom = (id: BottomPartId) => {
  const idx = activeBladeIndex.value as number
  localTeam.value[idx] = { ...localTeam.value[idx], bottomPartId: id }
  emit('save', localTeam.value.map(c => ({ ...c })))
}
</script>

<template lang="pug">
  FModal(
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :is-closable="true"
    :tabs="bladeTabs"
    :active-tab="activeBladeIndex"
    @update:active-tab="activeBladeIndex = $event"
  )
    div(class="space-y-4 max-h-[62vh] overflow-y-auto px-1 sm:px-3 py-2")

      //- ── Top Blade Parts ──────────────────────────────────────────────────
      div
        div.relative.flex.justify-center.items-center.mb-2

          div.absolute.left-0.flex.items-center.gap-1.rounded.font-bold(
            class="top-1/2 -translate-y-[50%] px-2 py-0.5 bg-yellow-600/60 text-yellow-300 text-[10px] sm:text-xs"
          )
            svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-3.5 h-3.5 text-yellow-300")
              circle(cx="12" cy="12" r="11" fill="black")
              circle(cx="12" cy="12" r="10" fill="currentColor")
              text(x="12" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="#2f920e") $
            span {{ coins }}g
          h3.text-yellow-300.font-black.uppercase.italic(
            class="text-xs sm:text-sm tracking-wider"
          ) Top Blade
        div.grid.gap-2(class="grid-cols-3 sm:grid-cols-5")
          div(
            v-for="part in TOP_PARTS_LIST"
            :key="part.id"
            @click="setTop(part.id)"
            class="cursor-pointer p-2 sm:p-3 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95"
            :class="currentConfig.topPartId === part.id \
            ? 'bg-gradient-to-b from-yellow-500 to-yellow-600 border-2 border-yellow-300' \
            : 'bg-slate-700 border-2 border-slate-600 hover:border-slate-400'"
          )
            div.text-center
              div.text-white.font-bold.truncate(class="text-[10px] sm:text-xs") {{ part.label }}
              div.text-yellow-400.font-bold(
                v-if="topLevel(part.id) > 0"
                class="text-[8px] sm:text-[10px]"
              ) Lv.{{ topLevel(part.id) }}
              div.mt-1(class="text-[9px] sm:text-[11px]")
                div.flex.items-center.justify-center(class="gap-0.5" :class="part.damageMultiplier >= 1.0 ? 'text-red-400' : 'text-gray-400'")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M14.17 1.92l-1.1 1.1 2.2 2.2-3.23 3.23-1.42-1.42-1.41 1.42 1.41 1.41-1.41 1.42-1.42-1.42-1.41 1.42 2.83 2.83 1.41-1.42-1.41-1.41 1.41-1.42 1.42 1.42 1.41-1.41 3.24-3.24 2.2 2.2 1.1-1.1z")
                  span {{ topDamage(part) }}x
                div.flex.items-center.justify-center(class="gap-0.5" :class="part.defenseMultiplier >= 1.0 ? 'text-blue-400' : 'text-gray-400'")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z")
                  span {{ topDefense(part) }}x
                div.flex.items-center.justify-center.text-green-400(class="gap-0.5" v-if="topHp(part) > 0")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
                  span +{{ topHp(part) }}
              //- Upgrade button
              div.mt-1
                button.rounded.font-bold.transition-all(
                  class="text-[8px] sm:text-[10px] px-1.5 py-0.5"
                  :class="coins >= upgradeCost(topLevel(part.id) + 1) \
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer' \
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'"
                  @click.stop="buyTopUpgrade(part.id)"
                ) ⬆ {{ upgradeCost(topLevel(part.id) + 1) }}g

      //- ── Bottom Parts ─────────────────────────────────────────────────────
      div
        h3.text-yellow-300.font-black.uppercase.italic.mb-2(
          class="text-xs sm:text-sm tracking-wider"
        ) Bottom Part
        div.grid.grid-cols-3.gap-2
          div(
            v-for="part in BOTTOM_PARTS_LIST"
            :key="part.id"
            @click="setBottom(part.id)"
            class="cursor-pointer p-2 sm:p-3 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95"
            :class="currentConfig.bottomPartId === part.id \
            ? 'bg-gradient-to-b from-yellow-500 to-yellow-600 border-2 border-yellow-300' \
            : 'bg-slate-700 border-2 border-slate-600 hover:border-slate-400'"
          )
            div.text-center
              div.text-white.font-bold(class="text-[10px] sm:text-xs") {{ part.label }}
              div.text-yellow-400.font-bold(
                v-if="bottomLevel(part.id) > 0"
                class="text-[8px] sm:text-[10px]"
              ) Lv.{{ bottomLevel(part.id) }}
              div.mt-1(class="text-[9px] sm:text-[11px]")
                div.flex.items-center.justify-center.text-cyan-400(class="gap-0.5")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z")
                  span {{ bottomSpeed(part) }}x
                div.flex.items-center.justify-center.text-gray-300(class="gap-0.5")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z")
                  span {{ part.weight }}
                div.flex.items-center.justify-center.text-green-400(class="gap-0.5" v-if="bottomHp(part) > 0")
                  svg.inline-block(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5 sm:w-3 sm:h-3")
                    path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
                  span +{{ bottomHp(part) }}
              //- Upgrade button
              div.mt-1
                button.rounded.font-bold.transition-all(
                  class="text-[8px] sm:text-[10px] px-1.5 py-0.5"
                  :class="coins >= upgradeCost(bottomLevel(part.id) + 1) \
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer' \
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'"
                  @click.stop="buyBottomUpgrade(part.id)"
                ) ⬆ {{ upgradeCost(bottomLevel(part.id) + 1) }}g

      //- ── Stats Summary ────────────────────────────────────────────────────
      div(class="border-t border-slate-500/50 pt-3")
        h3.text-yellow-300.font-black.uppercase.italic.mb-2(
          class="text-xs sm:text-sm tracking-wider"
        ) Total Stats
        div.grid.grid-cols-2.gap-x-4.gap-y-1(class="text-[10px] sm:text-xs")
          div.flex.justify-between.items-center
            span.flex.items-center.gap-1.text-gray-400
              svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-green-400")
                path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
              | HP
            span.text-green-400.font-bold {{ stats.maxHp }}
          div.flex.justify-between.items-center
            span.flex.items-center.gap-1.text-gray-400
              svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-gray-300")
                path(d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z")
              | Weight
            span.text-blue-400.font-bold {{ stats.totalWeight }}
          div.flex.justify-between.items-center
            span.flex.items-center.gap-1.text-gray-400
              svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-red-400")
                path(d="M14.17 1.92l-1.1 1.1 2.2 2.2-3.23 3.23-1.42-1.42-1.41 1.42 1.41 1.41-1.41 1.42-1.42-1.42-1.41 1.42 2.83 2.83 1.41-1.42-1.41-1.41 1.41-1.42 1.42 1.42 1.41-1.41 3.24-3.24 2.2 2.2 1.1-1.1z")
              | ATK
            span.text-red-400.font-bold {{ stats.damageMultiplier.toFixed(1) }}x
          div.flex.justify-between.items-center
            span.flex.items-center.gap-1.text-gray-400
              svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-purple-400")
                path(d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z")
              | DEF
            span.text-purple-400.font-bold {{ stats.defenseMultiplier.toFixed(1) }}x
          div.flex.justify-between.items-center
            span.flex.items-center.gap-1.text-gray-400
              svg(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-cyan-400")
                path(d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z")
              | SPD
            span.text-cyan-400.font-bold {{ stats.speedMultiplier.toFixed(1) }}x

</template>

<style scoped lang="sass">
</style>
