// Single entry point for ad placements. Picks a provider at module load
// time based on build flags and re-exports a stable surface
// (`isAdsReady`, `showRewardedAd`, `showMidgameAd`, `initAds`) that the
// four in-game ad placements bind to without caring which backend is
// live.
//
// Provider selection:
//   • `isCrazyWeb` build        → CrazyGames SDK (gate also requires
//                                  `isCrazyGamesFullRelease` inside the
//                                  provider)
//   • `showMediatorAds && isNative` → Unity LevelPlay (Tauri plugin)
//   • everything else           → Noop (ads UI hidden, calls inert)
//
// The CrazyGames SDK is still initialised directly from `main.ts` — it
// has to run before the SaveManager hydrates. LevelPlay init happens
// after mount via `initAds()` because the native side needs the Android
// Activity / iOS ViewController to be alive.
import { computed } from 'vue'
import { isCrazyWeb, isNative, showMediatorAds } from '@/use/useUser'
import type { AdProvider } from './ads/types'
import { createCrazyGamesProvider } from './ads/CrazyGamesProvider'
import { createLevelPlayProvider } from './ads/LevelPlayProvider'
import { createNoopProvider } from './ads/NoopProvider'

const provider: AdProvider = isCrazyWeb
  ? createCrazyGamesProvider()
  : (showMediatorAds && isNative)
    ? createLevelPlayProvider()
    : createNoopProvider()

export const adProviderName = provider.name
// `isAdsReady` is the coarse "SDK initialised" gate. Most placements
// should NOT bind directly to it — they want a per-format readiness
// flag that flips false when no ad is currently loaded, so the UI
// disappears instead of offering a button that does nothing on tap.
export const isAdsReady = computed(() => provider.isReady.value)
export const isRewardedReady = computed(() => provider.isRewardedReady.value)
export const isInterstitialReady = computed(() => provider.isInterstitialReady.value)

export const initAds = (): Promise<void> => provider.init()
export const showRewardedAd = (): Promise<boolean> => provider.showRewardedAd()
export const showMidgameAd = (): Promise<void> => provider.showMidgameAd()

const useAds = () => ({
  adProviderName,
  isAdsReady,
  isRewardedReady,
  isInterstitialReady,
  initAds,
  showRewardedAd,
  showMidgameAd
})

export default useAds
