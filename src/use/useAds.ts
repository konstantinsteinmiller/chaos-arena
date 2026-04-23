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
export const isAdsReady = computed(() => provider.isReady.value)

export const initAds = (): Promise<void> => provider.init()
export const showRewardedAd = (): Promise<boolean> => provider.showRewardedAd()
export const showMidgameAd = (): Promise<void> => provider.showMidgameAd()

const useAds = () => ({
  adProviderName,
  isAdsReady,
  initAds,
  showRewardedAd,
  showMidgameAd
})

export default useAds
