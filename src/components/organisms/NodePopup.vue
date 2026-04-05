<template lang="pug">
  Transition(
    name="pop"
    appear
    enter-active-class="transition-all duration-[250ms] ease-[cubic-bezier(0.18,0.89,0.32,1.28)]"
    leave-active-class="transition-all duration-[150ms] ease-[cubic-bezier(0.6,-0.28,0.735,0.045)]"
    enter-from-class="opacity-0 scale-0 translate-y-8"
    leave-to-class="opacity-0 scale-0 translate-y-8"
  )
    //- Container covers full screen to handle the click-away logic
    div(class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" :class="{ '!p-0': isMobilePortrait}")

      //- Transparent Backdrop (No blur, just intercepts clicks)
      div(
        class="absolute inset-0 pointer-events-auto bg-black/5"
        @click="emit('close')"
      )

      //- The Popup Card
      div(
        class="popup-card relative border-4 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden pointer-events-auto border-slate-600/80 bg-black/90"
        :class="{ '!scale-90 !max-w-xl': isMobileLandscape && node.npcTeam.length >= 5, '!scale-80 !max-w-xl ': isMobileLandscape && node.npcTeam.length > 15, '!max-w-full ': isMobilePortrait }"
      )
        //- Close Button
        FIconButton(
          class="absolute !top-2 !right-2 z-10 hover:scale-[103%] w-8 h-8 flex"
          @close="emit('close')"
        )

        //- Header
        div(class="p-3 pr-10 text-center bg-slate-700/70 border-b-2 border-slate-600/50")
          h2(class="text-xl font-black text-yellow-400 uppercase tracking-wide text-shadow") {{ node.name }}

        //- Body
        div(class="p-5 text-center" :class="{ '!p-1 !pb-2': isMobileLandscape }")
          p(class="text-sm text-white mb-4 italic text-shadow" :class="{ '!mb-2': isMobileLandscape }") "{{ node.description }}"

          //- Tiny Deck Preview
          div(class="flex justify-center flex-wrap gap-1 mb-5" :class="{ '!mb-2': isMobileLandscape }")
            div(
              v-for="i in node.npcTeam.length"
              :key="i"
              class="w-16 h-16"
            )
          //- Rules
          div(class="flex flex-wrap justify-center gap-4 text-white text-shadow items-center")
            div(class="text-amber-300 text-sm") {{ t('rules') }}:

        //- Action Footer
        div(class="p-4 pt-0" :class="{ '!pb-2': isMobileLandscape }")
          FButton(
            :attention="true"
            @click="emit('start')"
          ) {{ t('battle') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CampaignNode } from '@/use/useCampaign'
import FIconButton from '@/components/atoms/FIconButton'
import FButton from '@/components/atoms/FButton'
import { useI18n } from 'vue-i18n'
import { isMobileLandscape, isMobilePortrait, orientation } from '@/use/useUser'
import { mobileCheck } from '@/utils/function'
import useModels, { type Card, modelImgPath } from '@/use/useModels'

const props = defineProps<{
  node: CampaignNode
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start'): void
}>()

const { t } = useI18n()
const { allModels } = useModels()

const npcDeck = ref(allModels.filter((c: Card) => props.node.npcTeam.includes(c.id)))
npcDeck.value = npcDeck.value.map((c: Card) => {
  return {
    ...c,
    image: modelImgPath(c.id, c.element)
  }
})

const windowWidth = ref(window.innerWidth)
const isMobileLandscape = computed(() => mobileCheck() && windowWidth.value > 500 && orientation.value === 'landscape')
</script>

<style lang="sass" scoped>
.text-shadow
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5)

.pop-enter-to, .pop-leave-from
  opacity: 1
  transform: scale(1) translateY(0)
</style>