<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import FModal from '@/components/molecules/FModal'
import FButton from '@/components/atoms/FButton'
import type { BaybladeConfig, TopPartId, BottomPartId } from '@/types/bayblade'
import type { TabOption } from '@/components/atoms/FTabs'
import {
  TOP_PARTS_LIST,
  BOTTOM_PARTS_LIST,
  computeStats
} from '@/use/useBaybladeConfig'

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

// Sync when modal opens / props change
watch(() => props.initialTeam, (team) => {
  localTeam.value = team.map(c => ({ ...c }))
  activeBladeIndex.value = 0
}, { immediate: true })

watch(() => props.modelValue, (open) => {
  if (open) {
    localTeam.value = props.initialTeam.map(c => ({ ...c }))
    activeBladeIndex.value = 0
  }
})

// ─── Current Blade Being Edited ────────────────────────────────────────────

const currentConfig = computed(() =>
  localTeam.value[activeBladeIndex.value as number] ?? localTeam.value[0]
)

const stats = computed(() => computeStats(currentConfig.value))

const setTop = (id: TopPartId) => {
  const idx = activeBladeIndex.value as number
  localTeam.value[idx] = { ...localTeam.value[idx], topPartId: id }
}

const setBottom = (id: BottomPartId) => {
  const idx = activeBladeIndex.value as number
  localTeam.value[idx] = { ...localTeam.value[idx], bottomPartId: id }
}

// ─── Actions ───────────────────────────────────────────────────────────────

const close = () => emit('update:modelValue', false)

const save = () => {
  emit('save', localTeam.value.map(c => ({ ...c })))
  close()
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
        h3.text-yellow-300.font-black.uppercase.italic.mb-2(
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
              div.mt-1(class="text-[9px] sm:text-[11px]")
                div(:class="part.damageMultiplier >= 1.0 ? 'text-red-400' : 'text-gray-400'")
                  | ATK {{ part.damageMultiplier }}x
                div(:class="part.defenseMultiplier >= 1.0 ? 'text-blue-400' : 'text-gray-400'")
                  | DEF {{ part.defenseMultiplier }}x
                div.text-green-400(v-if="part.healthBonus > 0")
                  | +{{ part.healthBonus }} HP

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
              div.mt-1(class="text-[9px] sm:text-[11px]")
                div.text-cyan-400
                  | SPD {{ part.speedMultiplier }}x
                div.text-gray-300
                  | WT {{ part.weight }}
                div.text-green-400(v-if="part.healthBonus > 0")
                  | +{{ part.healthBonus }} HP

      //- ── Stats Summary ────────────────────────────────────────────────────
      div(class="border-t border-slate-500/50 pt-3")
        h3.text-yellow-300.font-black.uppercase.italic.mb-2(
          class="text-xs sm:text-sm tracking-wider"
        ) Total Stats
        div.grid.grid-cols-2.gap-x-4.gap-y-1(class="text-[10px] sm:text-xs")
          div.flex.justify-between
            span.text-gray-400 HP
            span.text-green-400.font-bold {{ stats.maxHp }}
          div.flex.justify-between
            span.text-gray-400 Weight
            span.text-blue-400.font-bold {{ stats.totalWeight }}
          div.flex.justify-between
            span.text-gray-400 ATK Mult
            span.text-red-400.font-bold {{ stats.damageMultiplier.toFixed(1) }}x
          div.flex.justify-between
            span.text-gray-400 DEF Mult
            span.text-purple-400.font-bold {{ stats.defenseMultiplier.toFixed(1) }}x
          div.flex.justify-between
            span.text-gray-400 Speed
            span.text-cyan-400.font-bold {{ stats.speedMultiplier.toFixed(1) }}x

    template(#footer)
      div.flex.gap-2.w-full(class="max-w-[280px]")
        FButton(type="secondary" @click="close") Cancel
        FButton(@click="save") Save
</template>

<style scoped lang="sass">
</style>
