<script setup lang="ts">
import FTabs, { type TabOption } from '@/components/atoms/FTabs'

interface Props {
  modelValue: boolean | any
  title?: string
  isClosable?: boolean
  tabs?: TabOption[]
  activeTab?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  isClosable: true,
  tabs: () => []
})

const emit = defineEmits(['update:modelValue', 'update:activeTab'])

const close = () => {
  emit('update:modelValue', false)
}

const handleTabChange = (val: string | number) => {
  emit('update:activeTab', val)
}
</script>

<template lang="pug">
  Transition(
    name="pop"
    appear
    enter-active-class="transition-all duration-[400ms] ease-[cubic-bezier(0.18,0.89,0.32,1.28)]"
    leave-active-class="transition-all duration-[200ms] ease-[cubic-bezier(0.6,-0.28,0.735,0.045)]"
    enter-from-class="opacity-0 scale-50 translate-y-12"
    leave-to-class="opacity-0 scale-50 translate-y-12"
  )
    div(v-if="modelValue" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4")
      //- Backdrop
      div(class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close")

      //- Modal Container
      div(class="model-container relative w-full max-w-lg")

        //- Header Area (Tabs or Ribbon)
        div(class="modal-header absolute -top-10 left-0 translate-y-2 right-0 z-10")
          //- CASE 1: Tabs provided
          template(v-if="tabs && tabs.length > 0")
            FTabs(
              :model-value="activeTab"
              @update:model-value="handleTabChange"
              :options="tabs"
            )

          //- CASE 2: Single Title Ribbon
          template(v-else-if="title")
            div(class="flex justify-center scale-70 sm:scale-100")
              div(class="relative")
                div(class="absolute inset-0 translate-y-1 rounded-lg bg-[#1a2b4b]")
                div(class="relative flex items-center justify-center bg-gradient-to-b from-[#ffcd00] to-[#f7a000] border-4 border-[#0f1a30] px-10 py-2 rounded-xl")
                  span(class="brawl-text text-2xl md:text-3xl text-white uppercase tracking-wider whitespace-nowrap")
                    | {{ title }}

        //- The Main Frame
        div(class="relative")
          div(class="absolute inset-0 translate-y-2 rounded-[1.5rem] sm:rounded-[2.5rem] bg-[#0c1626]")

          div(class="modal-frame relative bg-[#1a2b4b] border-[5px] border-[#0f1a30] rounded-[1.25rem] sm:rounded-[2rem] pt-7 pb-0 px-2 sm:px-4 sm:pt-6 md:p-8 md:pb-2 md:pt-10")

            //- Close Button (X)
            button(
              v-if="isClosable"
              @click="close"
              class="hover:scale-[103%] absolute top-0 right-0 group cursor-pointer transition-transform active:scale-40 sm:active:scale-90 scale-60 sm:scale-100 sm:top-2 sm:right-2 md:top-3 md:right-3"
            )
              div(class="relative")
                div(class="absolute inset-0 translate-y-1 rounded-lg bg-[#6b1212]")
                div(class="relative custom-red-bg border-2 border-[#0f1a30] rounded-lg p-2 text-white font-bold")
                  svg(xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M6 18L18 6M6 6l12 12")

            //- Content Slot
            div(class="text-white text-center")
              slot

            //- Footer Area for Actions
            div(class="mt-2 flex justify-center gap-4 mb-2")
              slot(name="footer")
</template>

<style scoped lang="sass">
.pop-enter-active
  animation: bounce-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)

.pop-leave-active
  animation: bounce-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) reverse

@keyframes bounce-in
  0%
    transform: scale(0.5)
    opacity: 0
  100%
    transform: scale(1)
    opacity: 1

.brawl-text
  text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

// ─── Landscape mobile: tighter chrome ────────────────────────────────────────
@media (orientation: landscape) and (max-height: 500px)
  .modal-overlay
    padding: 0.375rem
  .model-container
    max-width: 42rem
  .modal-header
    transform: translateY(0.25rem)
    top: -1.75rem
  .modal-frame
    padding-top: 1.25rem
    padding-bottom: 0
    padding-left: 0.375rem
    padding-right: 0.375rem
    border-width: 3px
    border-radius: 1rem
</style>