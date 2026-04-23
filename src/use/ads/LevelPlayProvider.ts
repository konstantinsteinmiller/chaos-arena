// Unity LevelPlay (ironSource) provider. Implemented in two phases:
//
//   Phase 1 (this file, current):
//     Pure-TS stub. `isReady` stays false and ad calls are inert, so the
//     four in-game ad placements are automatically hidden on native
//     builds until the native SDK bridge lands. This is the failsafe
//     behavior — no broken buttons, no silent-fail rewards.
//
//   Phase 2 (next):
//     `init()` will invoke the `plugin:levelplay|init` command exposed by
//     the workspace Tauri plugin at `src-tauri/plugins/tauri-plugin-levelplay/`,
//     passing the platform-specific app key and a locked set of COPPA/
//     Families-Policy metadata flags. `isReady` flips true on the
//     `ad-ready` event from native. Rewarded / interstitial calls are
//     also Tauri invokes, with the result delivered via events.
//
// App keys come from the Vite env (`.env`) — they're public identifiers,
// not secrets, and ship in the bundle regardless. Android and iOS have
// distinct keys assigned by the LevelPlay dashboard.
import { ref } from 'vue'
import type { AdProvider } from './types'

const androidAppKey = import.meta.env.VITE_APP_LEVELPLAY_ANDROID_APP_ID ?? ''
const iosAppKey = import.meta.env.VITE_APP_LEVELPLAY_IOS_APP_ID ?? ''

const isReady = ref(false)
let initStarted = false

// Rough platform detection from the user-agent. Good enough to pick the
// right app key before the Tauri OS plugin is wired — once we add
// `@tauri-apps/plugin-os` we'll swap this for `platform()`.
const detectPlatform = (): 'android' | 'ios' | 'other' => {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'other'
}

export const createLevelPlayProvider = (): AdProvider => ({
  name: 'levelplay',
  isReady,
  init: async () => {
    if (initStarted) return
    initStarted = true

    const platform = detectPlatform()
    const appKey = platform === 'android' ? androidAppKey : platform === 'ios' ? iosAppKey : ''

    if (!appKey) {
      console.warn(`[ads/levelplay] no app key for platform "${platform}" — ads disabled`)
      return
    }

    // Phase 2 will replace this with:
    //   await invoke('plugin:levelplay|init', {
    //     appKey,
    //     isChildDirected: true,
    //     admobTfcd: true,
    //     admobTfua: true,
    //     deviceIdOptOut: true,
    //     metaMixedAudience: false
    //   })
    //   listen('levelplay://ready', () => { isReady.value = true })
    console.info(`[ads/levelplay] stub init — platform=${platform}, appKey=${appKey.slice(0, 6)}… (native bridge pending)`)
  },
  showRewardedAd: async () => {
    // Phase 2: await invoke('plugin:levelplay|show_rewarded') and resolve
    // with the boolean delivered by the `levelplay://rewarded` event.
    return false
  },
  showMidgameAd: async () => {
    // Phase 2: await invoke('plugin:levelplay|show_interstitial').
  }
})
