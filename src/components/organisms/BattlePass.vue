<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import FModal from '@/components/molecules/FModal'
import FIconButton from '@/components/atoms/FIconButton.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import useBattlePass, {
  BP_TOTAL_STAGES,
  BP_XP_PER_STAGE
} from '@/use/useBattlePass'
import {
  MODEL_LABELS,
  modelImgPath,
  SKINS_PER_TOP,
  isSkinOwned,
  type BaybladeModelId
} from '@/use/useModels'
import type { TopPartId } from '@/types/bayblade'
import useSounds from '@/use/useSound.ts'

const {
  currentXp,
  unlockedStages,
  hasUnclaimedReward,
  pendingClaimCount,
  isStageClaimed,
  isStageUnlocked,
  bpCoinReward,
  bpIsSkinStage,
  claimStage,
  isMaxed
} = useBattlePass()

const { t } = useI18n()

const isModalOpen = ref(false)

// ─── Derived UI state ───────────────────────────────────────────────────────

/** The stage whose bar is currently being filled (1..TOTAL or 0 when maxed). */
const inProgressStage = computed(() =>
  isMaxed.value ? 0 : unlockedStages.value + 1
)

/** 0..1 fraction of xp into the in-progress stage. */
const progressFraction = computed(() =>
  Math.max(0, Math.min(1, currentXp.value / BP_XP_PER_STAGE))
)

/** List of all 50 stages as UI descriptors. */
const stageCards = computed(() =>
  Array.from({ length: BP_TOTAL_STAGES }, (_, i) => {
    const stage = i + 1
    return {
      stage,
      coins: bpCoinReward(stage),
      isSkin: bpIsSkinStage(stage),
      unlocked: isStageUnlocked(stage),
      claimed: isStageClaimed(stage),
      inProgress: stage === inProgressStage.value
    }
  })
)

// ─── Skin preview (for stages marked as skin rewards) ─────────────────────
// Dynamically pick an unowned skin to advertise on each unclaimed skin card,
// re-sampled whenever the modal opens so the preview reflects reality.

const offeredSkins = ref<Record<number, BaybladeModelId | null>>({})

const unownedSkinModelIds = (): BaybladeModelId[] => {
  const out: BaybladeModelId[] = []
  const seen = new Set<string>()
  for (const top of Object.keys(SKINS_PER_TOP) as TopPartId[]) {
    for (const m of SKINS_PER_TOP[top]) {
      if (seen.has(m)) continue
      if (!isSkinOwned(top, m)) {
        out.push(m)
        seen.add(m)
      }
    }
  }
  return out
}

const shuffled = <T, >(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

const refreshOfferedSkins = () => {
  const skinStages = stageCards.value.filter(c => c.isSkin && !c.claimed).map(c => c.stage)
  const pool = shuffled(unownedSkinModelIds())
  const result: Record<number, BaybladeModelId | null> = {}
  skinStages.forEach((stage, idx) => {
    result[stage] = pool[idx] ?? null
  })
  offeredSkins.value = result
}

// ─── Auto-scroll to the in-progress stage when the modal opens ─────────────

const stripRef = ref<HTMLElement | null>(null)

const scrollToCurrentStage = () => {
  if (!stripRef.value) return
  const target = inProgressStage.value > 0 ? inProgressStage.value : BP_TOTAL_STAGES
  const el = stripRef.value.querySelector<HTMLElement>(`[data-bp-stage="${target}"]`)
  if (!el) return
  const strip = stripRef.value
  const offset = el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2
  strip.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' })
}

watch(isModalOpen, (open) => {
  if (!open) {
    offeredSkins.value = {}
    return
  }
  refreshOfferedSkins()
  nextTick(() => scrollToCurrentStage())
})

// ─── Claim action ──────────────────────────────────────────────────────────

const onClaim = (stage: number) => {
  const { playSound } = useSounds()
  playSound('happy')
  const res = claimStage(stage)
  if (res) refreshOfferedSkins()
}
</script>

<template lang="pug">
  //- Open-modal button (positioned by parent flex row in BaybladeArena)
  div.battle-pass
    button.group.cursor-pointer.z-10.transition-transform(
      class="hover:scale-[103%] active:scale-90 scale-80 sm:scale-110"
      :class="{ 'hint-bounce': hasUnclaimedReward }"
      @click="isModalOpen = true"
    )
      div.relative
        div.absolute.inset-0.translate-y-1.rounded-lg(class="bg-[#1a2b4b]")
        div.relative.rounded-lg.border-2.text-white.font-bold.flex.flex-col.items-center.px-3.py-2(
          class="bg-gradient-to-b from-[#5b3bff] to-[#2a1a88] border-[#0f1a30] pt-3 sm:pt-2"
        )
          span.font-black.game-text.leading-tight.text-white(class="text-[10px] sm:text-xs") BP
          div.flex.items-center(class="gap-0.5")
            span.font-black.game-text.leading-none(
              class="text-[11px] sm:text-sm text-amber-300"
            ) {{ unlockedStages }}
            span.font-black.game-text.leading-none.text-white(
              class="text-[9px] sm:text-[10px] opacity-70"
            ) /{{ BP_TOTAL_STAGES }}
          //- Tiny unclaimed-count badge
          div.absolute.flex.items-center.justify-center.rounded-full.font-black.game-text(
            v-if="pendingClaimCount > 0"
            class="bg-red-500 text-white text-[9px] w-4 h-4 -top-1 -right-1 border border-[#0f1a30]"
          ) {{ pendingClaimCount }}

  //- Battle Pass Modal
  FModal(
    v-model="isModalOpen"
    :is-closable="true"
    :title="t('battlePass')"
  )
    div(class="space-y-3 px-1 sm:px-3 py-2")
      //- Summary row: current stage + xp progress bar
      div(class="flex items-center gap-2 px-1 sm:px-2")
        div.flex.flex-col.items-start.shrink-0
          span.text-gray-300.font-bold.uppercase(class="text-[8px] sm:text-[10px]") {{ t('stage') }}
          span.text-white.font-black.game-text.leading-none(class="text-lg sm:text-xl") {{ unlockedStages }}/{{ BP_TOTAL_STAGES }}
        div.flex-1.flex.flex-col.gap-1
          div.flex.justify-between.items-end
            span.text-gray-300.font-bold.uppercase(class="text-[8px] sm:text-[10px]")
              template(v-if="isMaxed") {{ t('complete') }}
              template(v-else) {{ t('stage') }} {{ inProgressStage }}
            span.text-yellow-400.font-black.game-text(class="text-[9px] sm:text-xs")
              template(v-if="isMaxed") {{ t('max') }}
              template(v-else) {{ Math.floor(currentXp) }}/{{ BP_XP_PER_STAGE }} xp
          div.relative.w-full.overflow-hidden.rounded-full.border(
            class="h-2.5 sm:h-3 bg-slate-800/70 border-slate-700"
          )
            div.h-full.rounded-full.transition-all(
              class="bg-gradient-to-r from-[#8b5cf6] via-[#a78bfa] to-[#fbbf24]"
              :style="{ width: `${progressFraction * 100}%` }"
            )

      //- Horizontal scroll strip of all 50 stages
      div.relative
        div.flex.gap-1.overflow-x-auto.overflow-y-hidden.py-2.px-1.bp-strip(
          ref="stripRef"
          class="sm:gap-2"
        )
          div(
            v-for="card in stageCards"
            :key="card.stage"
            :data-bp-stage="card.stage"
            class="shrink-0 flex flex-col items-center rounded-xl p-1 sm:p-2 border-2 transition-all w-16 sm:w-20"
            :class="[\
              card.claimed \
                ? 'bg-green-900/40 border-green-500/50' \
                : card.unlocked \
                  ? (card.isSkin ? 'bg-purple-900/40 border-purple-400' : 'bg-yellow-900/40 border-yellow-400') \
                  : card.inProgress \
                    ? (card.isSkin ? 'bg-purple-900/25 border-purple-500/70' : 'bg-yellow-900/25 border-yellow-500/70') \
                    : (card.isSkin ? 'bg-purple-900/20 border-purple-700/60' : 'bg-slate-700/50 border-slate-600')\
            ]"
          )
            //- Stage number
            div.text-gray-300.font-bold.uppercase(class="text-[8px] sm:text-[10px]") S{{ card.stage }}

            //- Reward icon
            template(v-if="card.isSkin && offeredSkins[card.stage]")
              div.skin-thumb-wrap.relative.flex.items-center.justify-center(
                class="w-6 h-6 sm:w-8 sm:h-8 my-0.5"
              )
                div.absolute.inset-0.rounded-full.pointer-events-none.skin-thumb-halo
                img(
                  :src="modelImgPath(offeredSkins[card.stage])"
                  class="relative w-full h-full object-contain"
                  :class="{ 'opacity-60': !card.unlocked && !card.claimed }"
                )
            template(v-else-if="card.isSkin")
              //- Skin stage but no unowned skin previewable — show a
              //- generic coin icon (claim will fall back to coins).
              IconCoin(class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 my-0.5 opacity-70")
            template(v-else)
              IconCoin(class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 my-0.5")

            //- Skin label
            div.font-black.game-text.text-purple-300.uppercase.tracking-wider.leading-tight(
              v-if="card.isSkin && offeredSkins[card.stage]"
              class="text-[7px] sm:text-[9px] truncate max-w-full"
            ) {{ MODEL_LABELS[offeredSkins[card.stage]] }}

            //- Coin amount (shown on coin stages, and as fallback hint on skin stages w/ empty pool)
            div.text-yellow-400.font-black.game-text.leading-tight(
              v-if="!card.isSkin || !offeredSkins[card.stage]"
              class="text-[9px] sm:text-xs"
            ) +{{ card.coins }}

            //- Status row
            div(class="mt-0.5 text-[8px] sm:text-[10px] font-bold")
              span.text-green-400(v-if="card.claimed") ✓
              template(v-else-if="card.unlocked")
                FIconButton(
                  type="primary"
                  size="sm"
                  icon="right"
                  @click="onClaim(card.stage)"
                )
              template(v-else-if="card.inProgress")
                span.text-amber-300 {{ Math.floor(progressFraction * 100) }}%
              span.text-slate-500(v-else) —

      //- Footer tip
      div.text-center(class="text-[10px] sm:text-xs text-slate-400")
        template(v-if="isMaxed")
          | {{ t('battlePassComplete') }}
        template(v-else-if="hasUnclaimedReward")
          | {{ t('rewardsReady', { n: pendingClaimCount }) }}
        template(v-else)
          | {{ t('xpHint') }}
</template>

<style scoped lang="sass">
// Hide the horizontal scrollbar on the stage strip while keeping it
// scrollable. Matches the visual language of the rest of the HUD.
.bp-strip
  scrollbar-width: none

  &::-webkit-scrollbar
    display: none

// Soft whiteish halo that sits behind skin thumbnails so dark models
// stay readable on the dark modal background (mirrors DailyRewards).
.skin-thumb-halo
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.28) 35%, rgba(255, 255, 255, 0) 75%)
  filter: blur(4px)
  transform: scale(1.15)
</style>

<i18n>
en:
  battlePass: "Battle Pass"
  complete: "COMPLETE"
  max: "MAX"
  battlePassComplete: "Battle Pass complete — nice work!"
  rewardsReady: "You have {n} reward(s) ready to collect!"
  xpHint: "Win campaign fights for +50xp, leaderboard fights for +25xp. Losses give +12xp."
de:
  battlePass: "Battle Pass"
  complete: "ABGESCHLOSSEN"
  max: "MAX"
  battlePassComplete: "Battle Pass abgeschlossen — gut gemacht!"
  rewardsReady: "Du hast {n} Belohnung(en) zum Abholen!"
  xpHint: "Kampagnenkämpfe gewinnen gibt +50xp, Bestenlisten-Kämpfe +25xp. Niederlagen geben +12xp."
fr:
  battlePass: "Battle Pass"
  complete: "TERMINÉ"
  max: "MAX"
  battlePassComplete: "Battle Pass terminé — bien joué !"
  rewardsReady: "Tu as {n} récompense(s) à récupérer !"
  xpHint: "Gagne des combats de campagne pour +50xp, classement +25xp. Défaites : +12xp."
es:
  battlePass: "Pase de Batalla"
  complete: "COMPLETO"
  max: "MÁX"
  battlePassComplete: "¡Pase de Batalla completado — buen trabajo!"
  rewardsReady: "¡Tienes {n} recompensa(s) para reclamar!"
  xpHint: "Gana combates de campaña para +50xp, de clasificación +25xp. Derrotas: +12xp."
jp:
  battlePass: "バトルパス"
  complete: "完了"
  max: "MAX"
  battlePassComplete: "バトルパス達成 — お見事！"
  rewardsReady: "{n} 個の報酬を受け取れます！"
  xpHint: "キャンペーン戦勝利で +50xp、ランキング戦で +25xp。敗北でも +12xp。"
kr:
  battlePass: "배틀 패스"
  complete: "완료"
  max: "MAX"
  battlePassComplete: "배틀 패스 완료 — 멋져요!"
  rewardsReady: "받을 수 있는 보상이 {n} 개 있습니다!"
  xpHint: "캠페인 전투 승리 +50xp, 리더보드 전투 +25xp. 패배 시 +12xp."
zh:
  battlePass: "战斗通行证"
  complete: "完成"
  max: "满级"
  battlePassComplete: "战斗通行证已完成 — 干得漂亮！"
  rewardsReady: "你有 {n} 个奖励可以领取！"
  xpHint: "赢得战役战斗 +50xp，排行榜战斗 +25xp，失败 +12xp。"
ru:
  battlePass: "Боевой пропуск"
  complete: "ЗАВЕРШЕНО"
  max: "МАКС"
  battlePassComplete: "Боевой пропуск пройден — отличная работа!"
  rewardsReady: "У вас {n} награда(ы) к получению!"
  xpHint: "Побед в кампании +50xp, в таблице лидеров +25xp. Поражения дают +12xp."
</i18n>
