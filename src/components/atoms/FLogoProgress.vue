<template lang="pug">
  div(class=" inset-0 flex items-center justify-center" :class="{ ' z-[9999]': progress < 100}")
    div(class="relative flex flex-col items-center")

      //- Logo Progress Container
      div(class="relative w-full h-full sm:w-32 sm:h-32")
        //- Background (Grayscale)
        img(
          src="/images/logo/logo_256x256.webp" alt="logo loader"
          class="absolute inset-0 w-full h-full object-contain grayscale opacity-30"
        )

        //- Foreground (Color - revealed by progress)
        div(
          class="absolute inset-0 w-full h-full overflow-hidden transition-all duration-300 ease-out"
          :style="maskStyle"
        )
          img(
            src="/images/logo/logo_256x256.webp" alt="logo loader"
            class="w-full h-full object-contain"
          )

      //- Loading Text
      div.absolute.-bottom-8(v-if="loadingProgress < 100" class="mt-0 flex flex-col items-center gap-1")
        //span(class="loading-text uppercase tracking-widest") {{ t('loading_assets') }}
        span(class="percentage-text text-shadow font-mono text-amber-500") {{ Math.round(progress) }}%
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useAssets from '@/use/useAssets'

const { t } = useI18n()
const { loadingProgress, preloadAssets } = useAssets()
const progress = computed(() => loadingProgress.value)

preloadAssets()

// Create the circular mask style
const maskStyle = computed(() => {
  return {
    // Standard and Webkit prefix for broad browser support
    '-webkit-mask-image': `conic-gradient(black ${progress.value}%, transparent ${progress.value}%)`,
    'mask-image': `conic-gradient(black ${progress.value}%, transparent ${progress.value}%)`,
    // Ensure the gradient starts from the top (12 o'clock)
    '-webkit-mask-origin': 'content-box',
    'mask-clip': 'content-box'
  }
})
</script>

<style scoped lang="sass">
.loading-text
  font-family: 'AmaticSC', serif
  font-size: 2rem
  color: white
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5)

.percentage-text
  font-size: 1.2rem
  font-weight: bold

// This helps the mask start from the top center
div[style*="conic-gradient"]
  transform: rotate(0deg)
  // Change to -90deg if you want it to start from the top
  mask-repeat: no-repeat
  -webkit-mask-repeat: no-repeat
</style>