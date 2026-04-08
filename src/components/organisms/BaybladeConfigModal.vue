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
import {
  SKINS_PER_TOP, SKIN_COST, MODEL_LABELS,
  modelImgPath, isSkinOwned, buySkin, selectSkin, getSelectedSkin,
  ownedSkinsForTop, hasUnownedSkinsForTop,
  markSkinPickerOpened, wasSkinPickerOpened,
  type BaybladeModelId
} from '@/use/useModels'
import IconCoin from '@/components/icons/IconCoin.vue'
import IconAttack from '@/components/icons/IconAttack.vue'
import IconDefense from '@/components/icons/IconDefense.vue'
import IconHp from '@/components/icons/IconHp.vue'
import IconSpeed from '@/components/icons/IconSpeed.vue'
import IconWeight from '@/components/icons/IconWeight.vue'

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
  emit('save', localTeam.value.map(c => ({ ...c })))
}

const buyBottomUpgrade = (id: BottomPartId) => {
  const cost = upgradeCost(bottomLevel(id) + 1)
  if (coins.value < cost) return
  addCoins(-cost)
  upgradeBottom(id)
  emit('save', localTeam.value.map(c => ({ ...c })))
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

// ─── Skin Picker ──────────────────────────────────────────────────────────

const skinPickerOpen = ref(false)
const skinPickerTopId = ref<TopPartId>('star')
const skinPickerKey = ref(0)

const openSkinPicker = (topId: TopPartId) => {
  skinPickerTopId.value = topId
  skinPickerOpen.value = true
  markSkinPickerOpened(topId)
}

/** True when the plus icon should hint-bounce (unowned skins available
 *  AND the player hasn't yet opened the picker for this top part). */
const shouldBouncePlus = (topId: TopPartId): boolean =>
  hasUnownedSkinsForTop(topId) && !wasSkinPickerOpened(topId)

const handleBuySkin = (topId: TopPartId, modelId: BaybladeModelId) => {
  if (coins.value < SKIN_COST) return
  addCoins(-SKIN_COST)
  buySkin(topId, modelId)
  skinPickerKey.value++
}

const handleSelectSkin = (topId: TopPartId, modelId: BaybladeModelId) => {
  selectSkin(topId, modelId)
  skinPickerKey.value++
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
    div.config-layout

      //- ── Top Blade Parts ──────────────────────────────────────────────────
      div.top-col
        div.relative.flex.justify-center.items-center.mb-1
          div.absolute.left-0.flex.items-center.gap-1.rounded.font-bold(
            class="top-1/2 -translate-y-[50%] px-1.5 py-0.5 bg-yellow-600/60 text-yellow-300 text-[9px] sm:text-xs"
          )
            IconCoin(class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-300")
            span {{ coins }}g
          h3.text-yellow-300.font-black.uppercase.italic(
            class="text-[10px] sm:text-sm tracking-wider"
          ) Top Blade
        div.grid.top-grid
          div(
            v-for="part in TOP_PARTS_LIST"
            :key="part.id"
            @click="setTop(part.id)"
            class="relative cursor-pointer rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col top-part-card"
            :class="currentConfig.topPartId === part.id \
            ? 'bg-gradient-to-b from-yellow-500 to-yellow-600 border-2 border-yellow-300' \
            : 'bg-slate-700 border-2 border-slate-600 hover:border-slate-400'"
          )
            //- Floating skin row above the card border:
            //- owned skin thumbnails + plus button to open the purchase modal
            div.skin-row.-mt-2.absolute.left-0.right-0.flex.justify-center.items-center.pointer-events-none(
              class="z-10"
            )
              div.flex.items-center.justify-center.rounded-full.bg-slate-900.border.border-slate-600.pointer-events-auto.skin-row-inner(
                class="px-1 py-0.5 gap-0.5 sm:gap-1 shadow-md"
              )
                div(
                  v-for="skinId in ownedSkinsForTop(part.id)"
                  :key="skinId"
                  @click.stop="handleSelectSkin(part.id, skinId)"
                  class="inline-flex shrink-0 rounded-full cursor-pointer transition-all skin-row-thumb"
                  :class="getSelectedSkin(part.id) === skinId\
                    ? 'ring-2 ring-yellow-300/80 scale-110'\
                    : 'hover:ring-2 hover:ring-slate-300 opacity-60 hover:opacity-100'"
                  :title="MODEL_LABELS[skinId]"
                )
                  img(
                    :src="modelImgPath(skinId)"
                    class="block rounded-full object-cover skin-row-img"
                    :alt="skinId"
                  )
                button.skin-plus-btn.ml-1.rounded-full.border-2.border-yellow-400.bg-slate-700.text-yellow-300.font-black.flex.items-center.justify-center.cursor-pointer.transition-all(
                  class="hover:bg-slate-600 hover:scale-110"
                  :class="shouldBouncePlus(part.id) ? 'hint-bounce-2' : ''"
                  @click.stop="openSkinPicker(part.id)"
                  title="Purchase more skins"
                ) +
            div.text-center.part-card-body
              div.text-white.font-bold.truncate.game-text(class="text-[9px] sm:text-xs") {{ part.label }}
              div.flex.flex-col.items-center.stat-list
                div.flex.items-center.justify-center.text-red-400.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]")
                  IconAttack.inline-block.stat-icon
                  span {{ topDamage(part) }}x
                div.flex.items-center.justify-center.text-blue-400.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]")
                  IconDefense.inline-block.stat-icon
                  span {{ topDefense(part) }}x
                div.flex.items-center.justify-center.text-green-400.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]" v-if="topHp(part) > 0")
                  IconHp.inline-block.stat-icon
                  span +{{ topHp(part) }}
            //- Upgrade button integrated at card bottom
            button.w-full.rounded-b-lg.font-bold.transition-all.mt-auto.upgrade-btn(
              :class="coins >= upgradeCost(topLevel(part.id) + 1) \
                ? 'bg-yellow-500 hover:bg-yellow-400 text-white cursor-pointer' \
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'"
              @click.stop="buyTopUpgrade(part.id)"
            )
              span.flex.items-center.justify-center(class="gap-0.5 -mt-[2px] pt-[2px]")
                span.game-text ⬆
                IconCoin.upgrade-coin-icon.text-yellow-300
                span.game-text {{ upgradeCost(topLevel(part.id) + 1) }}
            //- Level badge — bottom-right corner, overlapping the upgrade button
            div.level-badge.absolute.font-black.game-text.text-white.flex.items-center.justify-center.pointer-events-none(
              v-if="topLevel(part.id) > 0"
              class="-mb-[4px] bg-gradient-to-b from-purple-500 to-purple-800 border border-yellow-300 rounded-md shadow-md z-20"
            ) Lv.{{ topLevel(part.id) }}

      //- ── Bottom + Stats Column ────────────────────────────────────────────
      div.bottom-col

        //- ── Bottom Parts ───────────────────────────────────────────────────
        div
          h3.text-yellow-300.font-black.uppercase.italic.mb-1(
            class="text-[10px] sm:text-sm tracking-wider"
          ) Bottom Part
          div.grid.grid-cols-3.bottom-grid
            div(
              v-for="part in BOTTOM_PARTS_LIST"
              :key="part.id"
              @click="setBottom(part.id)"
              class="relative cursor-pointer rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col"
              :class="currentConfig.bottomPartId === part.id \
              ? 'bg-gradient-to-b from-yellow-500 to-yellow-600 border-2 border-yellow-300' \
              : 'bg-slate-700 border-2 border-slate-600 hover:border-slate-400'"
            )
              div.text-center.part-card-body
                div.text-white.font-bold.game-text(class="text-[9px] sm:text-xs") {{ part.label }}
                div.flex.flex-col.items-center.stat-list
                  div.flex.items-center.justify-center.text-cyan-400.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]")
                    IconSpeed.inline-block.stat-icon
                    span {{ bottomSpeed(part) }}x
                  div.flex.items-center.justify-center.text-gray-300.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]")
                    IconWeight.inline-block.stat-icon
                    span {{ part.weight }}
                  div.flex.items-center.justify-center.text-green-400.rounded-full.stat-glass(class="gap-0.5 px-[2px] py-[1px]" v-if="bottomHp(part) > 0")
                    IconHp.inline-block.stat-icon
                    span +{{ bottomHp(part) }}
              //- Upgrade button integrated at card bottom
              button.w-full.rounded-b-lg.font-bold.transition-all.mt-auto.upgrade-btn(
                :class="coins >= upgradeCost(bottomLevel(part.id) + 1) \
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-white cursor-pointer' \
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'"
                @click.stop="buyBottomUpgrade(part.id)"
              )
                span.flex.items-center.justify-center(class="gap-0.5 -mt-[2px] pt-[2px]")
                  span.game-text ⬆
                  IconCoin.upgrade-coin-icon.text-yellow-300
                  span.game-text {{ upgradeCost(bottomLevel(part.id) + 1) }}
              //- Level badge — bottom-right corner, overlapping the upgrade button
              div.level-badge.absolute.font-black.game-text.text-white.flex.items-center.justify-center.pointer-events-none(
                v-if="bottomLevel(part.id) > 0"
                class="-mb-[4px] bg-gradient-to-b from-purple-500 to-purple-800 border border-yellow-300 rounded-md shadow-md z-20"
              ) Lv.{{ bottomLevel(part.id) }}

        //- ── Stats Summary ──────────────────────────────────────────────────
        div.stats-bar(class="border-t border-slate-500/50")
          h3.text-yellow-300.font-black.uppercase.italic(
            class="text-[9px] sm:text-xs tracking-wider"
          ) Stats
          div.flex.flex-wrap.justify-center.stats-items
            div.flex.items-center
              IconHp.stat-summary-icon.text-green-400
              span.text-green-400.font-bold {{ stats.maxHp }}
            div.flex.items-center
              IconWeight.stat-summary-icon.text-gray-300
              span.text-blue-400.font-bold {{ stats.totalWeight }}
            div.flex.items-center
              IconAttack.stat-summary-icon.text-red-400
              span.text-red-400.font-bold {{ stats.damageMultiplier.toFixed(1) }}x
            div.flex.items-center
              IconDefense.stat-summary-icon.text-purple-400
              span.text-purple-400.font-bold {{ stats.defenseMultiplier.toFixed(1) }}x
            div.flex.items-center
              IconSpeed.stat-summary-icon.text-cyan-400
              span.text-cyan-400.font-bold {{ stats.speedMultiplier.toFixed(1) }}x

  //- ── Skin Picker Modal ───────────────────────────────────────────────────
  FModal(
    :model-value="skinPickerOpen"
    @update:model-value="skinPickerOpen = $event"
    :is-closable="true"
    title="Select Skin"
    :key="'skin-' + skinPickerKey"
  )
    div(class="px-2 sm:px-4 py-2")
      div.flex.items-center.justify-between.mb-2
        div.flex.items-center.gap-1.rounded.font-bold(
          class="px-2 py-0.5 bg-yellow-600/60 text-yellow-300 text-[10px] sm:text-xs"
        )
          IconCoin(class="w-3.5 h-3.5 text-yellow-300")
          span {{ coins }}g
      div.grid.gap-2(class="grid-cols-3 sm:grid-cols-4")
        div(
          v-for="modelId in SKINS_PER_TOP[skinPickerTopId]"
          :key="modelId"
          class="flex flex-col items-center rounded-xl p-1.5 border-2 transition-all"
          :class="[\
            getSelectedSkin(skinPickerTopId) === modelId\
              ? 'bg-gradient-to-b from-yellow-500/30 to-yellow-600/30 border-yellow-400'\
              : isSkinOwned(skinPickerTopId, modelId)\
                ? 'bg-slate-700 border-slate-500 hover:border-slate-300 cursor-pointer'\
                : 'bg-slate-800 border-slate-600'\
          ]"
        )
          img(
            :src="modelImgPath(modelId)"
            class="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-lg"
            :alt="modelId"
          )
          div.text-white.font-bold(class="mt-0.5 text-[9px] sm:text-xs") {{ MODEL_LABELS[modelId] }}
          //- Action button
          template(v-if="getSelectedSkin(skinPickerTopId) === modelId")
            div.text-yellow-400.font-bold(class="mt-0.5 text-[8px] sm:text-[10px]") EQUIPPED
          template(v-else-if="isSkinOwned(skinPickerTopId, modelId)")
            button.rounded-lg.font-bold.transition-all(
              class="mt-0.5 text-[8px] sm:text-[10px] px-3 py-0.5 bg-green-600 hover:bg-green-500 text-white cursor-pointer"
              @click="handleSelectSkin(skinPickerTopId, modelId)"
            ) SELECT
          template(v-else)
            button.rounded-lg.font-bold.transition-all(
              class="mt-0.5 text-[8px] sm:text-[10px] px-2 py-0.5 flex items-center gap-1"
              :class="coins >= SKIN_COST\
                ? 'bg-yellow-500 hover:bg-yellow-400 text-white cursor-pointer'\
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'"
              @click="handleBuySkin(skinPickerTopId, modelId)"
            )
              IconCoin(class="w-3 h-3 text-yellow-300")
              span.game-text {{ SKIN_COST }}
</template>

<style scoped lang="sass">
.stat-glass
  background: rgba(255, 255, 255, 0.06)
  backdrop-filter: blur(6px)
  -webkit-backdrop-filter: blur(6px)
  border: 1px solid rgba(255, 255, 255, 0.08)
  line-height: 1

// ─── Base Layout (portrait / desktop) ────────────────────────────────────────

.config-layout
  display: flex
  flex-direction: column
  gap: 0.375rem
  padding: 0.25rem 0.25rem

.top-col, .bottom-col
  min-width: 0

.top-grid
  grid-template-columns: repeat(3, 1fr)
  gap: 0.375rem
  // Leave room for the floating skin row that overflows above each card
  padding-top: 1rem
  row-gap: 1.25rem

.bottom-grid
  gap: 0.375rem

.part-card-body
  padding: 0.2rem 0.2rem 0

// Top part card needs internal top padding so the floating row above
// the border doesn't visually collide with the part label.
.top-part-card
  padding-top: 0.375rem

.stat-list
  margin-top: 0.125rem
  gap: 1px
  font-size: 9px

  span
    text-shadow: 1px 1px 0 #333, -1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333

.stat-icon
  width: 0.625rem
  height: 0.625rem

// Floating skin row sitting above the top-part card border
.skin-row
  top: -0.85rem

.skin-row-thumb
  width: 0.95rem
  height: 0.95rem
  line-height: 0

.skin-row-img
  width: 100%
  height: 100%

.skin-plus-btn
  width: 1.05rem
  height: 1.05rem
  font-size: 0.85rem
  line-height: 1
  padding: 0

// Level badge anchored to the card's bottom-right, overlapping the
// upgrade button so it pops above the yellow background.
.level-badge
  right: -0.2rem
  bottom: -0.25rem
  font-size: 8px
  line-height: 1
  padding: 1px 3px
  text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000

.upgrade-btn
  font-size: 8px
  padding: 0.125rem 0

.upgrade-coin-icon
  width: 0.625rem
  height: 0.625rem

.stats-bar
  padding-top: 0.375rem
  margin-top: 0.25rem
  display: flex
  align-items: center
  gap: 0.5rem
  flex-wrap: wrap

.stats-items
  gap: 0.5rem
  font-size: 10px

.stat-summary-icon
  width: 0.75rem
  height: 0.75rem
  margin-right: 0.125rem

// ─── sm+ breakpoint (≥640px) ─────────────────────────────────────────────────

@media (min-width: 640px)
  .top-grid
    grid-template-columns: repeat(6, 1fr)
    gap: 0.5rem
    padding-top: 1.25rem
    row-gap: 1.5rem

  .bottom-grid
    gap: 0.5rem

  .part-card-body
    padding: 0.375rem 0.375rem 0

  .top-part-card
    padding-top: 0.5rem

  .stat-list
    font-size: 11px
    gap: 2px

  .stat-icon
    width: 0.75rem
    height: 0.75rem

  .skin-row
    top: -1rem

  .skin-row-thumb
    width: 1.25rem
    height: 1.25rem

  .skin-row-img
    width: 100%
    height: 100%

  .skin-plus-btn
    width: 1.35rem
    height: 1.35rem
    font-size: 1rem

  .level-badge
    right: -0.3rem
    bottom: -0.35rem
    font-size: 10px
    padding: 2px 5px

  .upgrade-btn
    font-size: 10px
    padding: 0.125rem 0

  .upgrade-coin-icon
    width: 0.625rem
    height: 0.625rem

  .stats-items
    font-size: 12px

  .stat-summary-icon
    width: 0.875rem
    height: 0.875rem

// ─── Landscape mobile (short viewport) ──────────────────────────────────────

@media (orientation: landscape) and (max-height: 500px)
  .config-layout
    flex-direction: row
    gap: 0.5rem
    padding: 0.125rem 0.25rem

  .top-col
    flex: 3
    min-width: 0

  .bottom-col
    flex: 2
    min-width: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

  .top-grid
    grid-template-columns: repeat(3, 1fr)
    gap: 0.25rem
    padding-top: 0.85rem
    row-gap: 1rem

  .bottom-grid
    gap: 0.25rem

  .part-card-body
    padding: 0.125rem 0.125rem 0

  .top-part-card
    padding-top: 0.3rem

  .stat-list
    font-size: 8px
    gap: 2px

  .stat-icon
    width: 0.5rem
    height: 0.5rem

  .skin-row
    top: -0.7rem

  .skin-row-thumb
    width: 0.75rem
    height: 0.75rem

  .skin-row-img
    width: 100%
    height: 100%

  .skin-plus-btn
    width: 0.85rem
    height: 0.85rem
    font-size: 0.7rem

  .level-badge
    right: -0.15rem
    bottom: -0.2rem
    font-size: 7px
    padding: 1px 2px

  .upgrade-btn
    font-size: 7px
    padding: 1px 0

  .upgrade-coin-icon
    width: 0.5rem
    height: 0.5rem

  .stats-bar
    padding-top: 0.2rem
    margin-top: 0.125rem
    gap: 0.25rem

  .stats-items
    gap: 0.375rem
    font-size: 8px

  .stat-summary-icon
    width: 0.625rem
    height: 0.625rem
    margin-right: 1px
</style>
