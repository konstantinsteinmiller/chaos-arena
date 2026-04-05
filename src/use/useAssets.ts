import { ref } from 'vue'
import { modelImgPath } from '@/use/useModels.ts'
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
  'images/bg/campaign-map_800x710.webp',
  'images/bg/campaign-map_800x1600.webp',
  'images/bg/campaign-map_1600x800.webp',
  'images/bg/oak_600x588.webp',
  'images/icons/difficulty-icon_128x128.webp',
  'images/icons/settings-icon_128x128.webp',
  'images/icons/sound-icon_128x128.webp'
]

const BG_IMAGE = [
  '/images/board/papyrus-tile_128x128.webp',
  'images/board/papyrus-tile_128x128.webp',
  './images/board/papyrus-tile_128x128.webp',
  '/images/bg/bg_1024x1024.webp',
  'images/bg/bg_1024x1024.webp',
  './images/bg/bg_1024x1024.webp'
]

const SOUND_ASSETS = [
  'audio/sfx/plus.ogg',
  'audio/sfx/same.ogg',
  'audio/sfx/combo.ogg',
  'audio/sfx/turn-card.ogg',
  'audio/sfx/hover-card.ogg',
  'audio/sfx/place-card.ogg',
  'audio/sfx/draw.ogg',
  'audio/sfx/win.ogg',
  'audio/sfx/lose.ogg',
  'audio/sfx/card-pack-open.ogg',
  'audio/sfx/reward-continue.ogg'
]

const MUSIC_ASSETS = [
  'audio/music/battle.ogg',
  'audio/music/adventure_main-menu.mp3'
]

export default () => {
  const preloadAssets = async () => {
    if (areAllAssetsLoaded.value) return

    // Combine static list with the recursively found model images
    const allImages = [
      ...BG_IMAGE,
      ...STATIC_IMAGES.map(src => prependBaseUrl(src))
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