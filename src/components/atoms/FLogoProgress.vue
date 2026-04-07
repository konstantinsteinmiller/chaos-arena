<template lang="pug">
  div(
    ref="logoRef"
    class="fixed z-[100] transition-all ease-in-out"
    :class="[settled ? 'duration-700 !z-[1]' : 'duration-0 z-[200]']"
    :style="positionStyle"
  )
    div(class="relative flex flex-col items-center")

      //- Logo Progress Container
      div(
        class="relative transition-all duration-700 ease-in-out"
        :style="sizeStyle"
      )
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
      div.absolute.-bottom-8(v-if="!done" class="mt-0 flex flex-col items-center gap-1")
        span(class="percentage-text text-shadow font-mono text-amber-500") {{ Math.round(progress) }}%
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import useAssets from '@/use/useAssets'

const { loadingProgress, preloadAssets } = useAssets()
const progress = computed(() => loadingProgress.value)

preloadAssets()

const done = ref(false)
const settled = ref(false)

// Compute 40% of the smaller viewport dimension
const viewportSize = ref(Math.min(window.innerWidth, window.innerHeight))
const logoRef = ref<HTMLElement | null>(null)

const onResize = () => {
  viewportSize.value = Math.min(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  // Let initial position render before enabling transitions
  requestAnimationFrame(() => {
    settled.value = true
  })
})
onUnmounted(() => window.removeEventListener('resize', onResize))

const centeredSize = computed(() => Math.floor(viewportSize.value * 0.4))
const finalSize = 64 // w-16 h-16

const sizeStyle = computed(() => {
  const s = done.value ? finalSize : centeredSize.value
  return { width: `${s}px`, height: `${s}px` }
})

const positionStyle = computed(() => {
  if (done.value) {
    // Top-left below stage badge (~56px down, 12px left)
    return { top: '52px', left: '12px', transform: 'none' }
  }
  // Centered
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
})

watch(progress, (val) => {
  if (val >= 100 && !done.value) {
    // Small delay so user sees 100% before transition
    setTimeout(() => {
      done.value = true
    }, 100)
  }
})

// Create the circular mask style
const maskStyle = computed(() => {
  return {
    '-webkit-mask-image': `conic-gradient(black ${progress.value}%, transparent ${progress.value}%)`,
    'mask-image': `conic-gradient(black ${progress.value}%, transparent ${progress.value}%)`,
    '-webkit-mask-origin': 'content-box',
    'mask-clip': 'content-box'
  }
})
</script>

<style scoped lang="sass">
.percentage-text
  font-size: 1.2rem
  font-weight: bold

div[style*="conic-gradient"]
  transform: rotate(0deg)
  mask-repeat: no-repeat
  -webkit-mask-repeat: no-repeat
</style>
