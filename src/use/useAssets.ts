import { ref } from 'vue'
import { modelImgPath, BAYBLADE_MODEL_IDS } from '@/use/useModels.ts'
import { prependBaseUrl } from '@/utils/function.ts'

// Shared state so it can be accessed by both the loader and the progress component
const loadingProgress = ref(0)
const areAllAssetsLoaded = ref(false)

// THIS IS THE KEY: A persistent memory reference
const resourceCache = {
  images: new Map<string, HTMLImageElement>(),
  audio: new Map<string, HTMLAudioElement>()
}

const STATIC_IMAGES = [
  'images/logo/logo_256x256.webp',
  'images/icons/difficulty-icon_128x128.webp',
  'images/icons/settings-icon_128x128.webp',
  'images/icons/sound-icon_128x128.webp',
  'images/icons/team_128x128.webp',
  'images/icons/gears_128x128.webp',
  'images/icons/movie_128x96.webp',
  'images/icons/chest_128x128.webp',
  'images/bg/parchment-ribbon_553x188.webp'
]

const SOUND_ASSETS = [
  'audio/sfx/clash-1.ogg',
  'audio/sfx/clash-2.ogg',
  'audio/sfx/clash-3.ogg',
  'audio/sfx/clash-4.ogg',
  'audio/sfx/clash-5.ogg',
  'audio/sfx/celebration-1.ogg',
  'audio/sfx/celebration-2.ogg',
  'audio/sfx/win.ogg',
  'audio/sfx/lose.ogg',
  'audio/sfx/reward-continue.ogg'
]

const MUSIC_ASSETS = [
  'audio/music/battle-1.ogg',
  'audio/music/battle-2.ogg',
  'audio/music/battle-3.ogg',
]

export default () => {
  const preloadAssets = async () => {
    if (areAllAssetsLoaded.value) return

    // Combine static list with the model images
    const baybladeModelImages = BAYBLADE_MODEL_IDS.map(id => modelImgPath(id))
    const allImages = [
      ...STATIC_IMAGES.map(src => prependBaseUrl(src)),
      ...baybladeModelImages
    ]

    const allAssets = [
      ...allImages.map(src => ({ src, type: 'image' })),
      ...SOUND_ASSETS.map(src => prependBaseUrl(src)).map(src => ({ src, type: 'audio' })),
      ...MUSIC_ASSETS.map(src => prependBaseUrl(src)).map(src => ({ src, type: 'audio' }))
    ]

    let loadedCount = 0
    const totalCount = allAssets.length

    const updateProgress = () => {
      loadedCount++
      loadingProgress.value = Math.floor((loadedCount / totalCount) * 100)
    }

    const loadAsset = ({ src, type }: { src: string, type: string }) => {
      // If the string is already in our Map, it's already preloaded
      if (type === 'image' && resourceCache.images.has(src)) {
        loadedCount++
        loadingProgress.value = Math.floor((loadedCount / totalCount) * 100)
        return Promise.resolve()
      }

      return new Promise((resolve) => {
        if (type === 'image') {
          const img = new Image()
          img.onload = () => {
            resourceCache.images.set(src, img)
            loadedCount++
            loadingProgress.value = Math.floor((loadedCount / totalCount) * 100)
            resolve(img)
          }
          img.onerror = () => {
            console.error('Preload fail:', src)
            resolve(null)
          }
          img.src = src // This string is exactly what modelImgPath returns
        } else {
          const audio = new Audio()
          audio.oncanplaythrough = () => {
            resourceCache.audio.set(src, audio)
            loadedCount++
            loadingProgress.value = Math.floor((loadedCount / totalCount) * 100)
            resolve(audio)
          }
          audio.onerror = resolve
          audio.src = src
          audio.load()
        }
      })
    }

    try {
      // Load in chunks of 10 to avoid hammering the connection
      // which some portals flag as suspicious/DDOS
      for (let i = 0; i < allAssets.length; i += 10) {
        const chunk = allAssets.slice(i, i + 10)
        await Promise.all(chunk.map(loadAsset))
      }

      areAllAssetsLoaded.value = true
      loadingProgress.value = 100
      // console.log('resourceCache: ', resourceCache)
    } catch (error) {
      console.error('Preload failed:', error)
      loadingProgress.value = 100
    }
  }

  return {
    loadingProgress,
    areAllAssetsLoaded,
    preloadAssets,
    resourceCache // Export this if you want to debug memory usage
  }
}