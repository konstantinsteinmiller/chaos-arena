import { prependBaseUrl } from '@/utils/function'
import useUser from '@/use/useUser'

import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

// We keep the audio instance outside the hook so it's a true Singleton
const bgMusic = ref<HTMLAudioElement | null>(null)
const isLoaded = ref(false)
const isPlaying = ref(false)

export const useMusic = () => {
  const { userMusicVolume } = useUser()
  const route = useRoute()

  watch(userMusicVolume, () => {
    if (!bgMusic.value) return
    bgMusic.value.volume = userMusicVolume.value * 0.015
  })

  const pauseMusic = () => {
    if (bgMusic.value) {
      // bgMusic.value.volume = 0
      bgMusic.value.pause()
      isPlaying.value = false
    }
  }

  const continueMusic = () => {
    if (bgMusic.value) {
      // bgMusic.value.volume = userMusicVolume.value
      playWithFade()
    }
  }

  watch(() => route, () => {
    if (bgMusic.value && bgMusic.value?.dataset?.name !== undefined && route.name === 'battle') {
      bgMusic.value?.pause()
      const idx = Math.floor(Math.random() * 3) + 1
      const filename = `battle-${idx}.ogg`
      bgMusic.value.dataset.name = 'battle'
      bgMusic.value.src = prependBaseUrl('audio/music/' + filename)
      bgMusic.value.addEventListener('canplaythrough', () => {
        isLoaded.value = true
        playWithFade()
      }, { once: true })
    } else if (bgMusic.value && (bgMusic.value?.dataset?.name === 'battle-3'
        || bgMusic.value?.dataset?.name === 'battle-2' || bgMusic.value?.dataset?.name === 'battle-1')
      && route.name !== 'battle') {
      bgMusic.value?.pause()
    }
  }, { deep: true, immediate: true })

  const initMusic = (filename: string) => {
    onMounted(() => {
      if (bgMusic.value && bgMusic.value?.dataset.name === filename) return // Already initialized
      // 1. Create the audio object
      const audio = new Audio()
      audio.src = prependBaseUrl('audio/music/' + filename)
      audio.loop = true
      audio.volume = userMusicVolume.value * 0.001
      audio.preload = 'auto'
      audio.dataset.name = filename

      // 2. Wait for the browser to have enough data to play through
      audio.addEventListener('canplaythrough', () => {
        isLoaded.value = true
        bgMusic.value = audio
        playWithFade()
      }, { once: true })

      // 3. Start the lazy load
      audio.load()
    })
    onUnmounted(() => {
      bgMusic.value?.pause()
      bgMusic.value?.removeAttribute('src') // Clear the source
      bgMusic.value = null
    })
  }

  const playWithFade = () => {
    if (!bgMusic.value) return

    // Browsers block autoplay until user interaction
    bgMusic.value.play().then(() => {
      isPlaying.value = true
      fadeIn()
    }).catch(() => {
      // console.log('Autoplay blocked: Waiting for user interaction to start music.')
      // Attach a one-time listener to the window to play on first click
      window.addEventListener('click', () => {
        if (!isPlaying.value) playWithFade()
      }, { once: true })
    })
  }

  const fadeIn = () => {
    if (!bgMusic.value) return
    let vol = 0
    const interval = setInterval(() => {
      if (vol < userMusicVolume.value * 0.025) {
        vol += 0.005
        bgMusic.value!.volume = vol
      } else {
        clearInterval(interval)
      }
    }, 50)
  }


  return { initMusic, isLoaded, isPlaying, pauseMusic, continueMusic }
}

const useSounds = () => {
  const { userSoundVolume } = useUser()

  const playSound = (effect: string, ratio = 0.025) => {
    const audio = new Audio(prependBaseUrl(`audio/sfx/${effect}.ogg`))
    // iOS requires volume to be set BEFORE play()
    audio.volume = userSoundVolume.value * ratio
    audio.play().catch(e => console.warn('SFX play blocked:', e))
  }

  return {
    playSound
  }
}

export default useSounds

