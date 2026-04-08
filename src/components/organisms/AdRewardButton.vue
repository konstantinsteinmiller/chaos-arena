<script setup lang="ts">
import IconCoin from '@/components/icons/IconCoin.vue'
import { isCrazySDKIntegrated } from '@/use/useMatch.ts'
import useBaybladeConfig from '@/use/useBaybladeConfig'

interface Props {
  /** How many coins the player gets after watching the ad. */
  coins?: number
}

const props = withDefaults(defineProps<Props>(), {
  coins: 100
})

const { addCoins } = useBaybladeConfig()

// Triggers the rewarded video ad. Stub: integrate the ad SDK here.
// On successful video completion, call `grantReward()` to credit the coins.
const triggerAdReward = () => {
  // TODO: integrate rewarded video ad SDK
  //   On video completion → grantReward()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const grantReward = () => {
  addCoins(props.coins)
}
</script>

<template lang="pug">
  button.group.cursor-pointer.z-10.transition-transform(
    v-if="isCrazySDKIntegrated"
    class="hover:scale-[103%] active:scale-90 scale-80 sm:scale-110"
    @click="triggerAdReward"
  )
    div.relative
      div.absolute.inset-0.translate-y-1.rounded-lg(class="bg-[#1a2b4b]")
      div.relative.rounded-lg.border-2.text-white.font-bold.flex.flex-col.items-center.px-2.py-1(
        class="bg-gradient-to-b from-[#ffcd00] to-[#f7a000] border-[#0f1a30]"
      )
        div.flex.items-center.gap-1
          span.font-black.game-text.leading-tight(class="text-[10px] sm:text-xs") +{{ coins }}
          IconCoin.inline(class="w-4 h-4 text-yellow-300")
        img.object-contain(
          src="/images/icons/movie_128x96.webp"
          class="h-7 w-7 sm:h-8 sm:w-8"
        )
</template>
