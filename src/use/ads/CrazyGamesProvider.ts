// Wraps the existing CrazyGames SDK integration in the AdProvider shape.
// Init happens in `main.ts` via `initCrazyGames()` (must run before the
// SaveManager hydrates), so this provider's `init()` is a no-op — by the
// time `useAds.initAds()` is called the SDK is already up (or permanently
// inactive on non-CG builds).
import { computed } from 'vue'
import { isSdkActive, showRewardedAd, showMidgameAd } from '@/use/useCrazyGames'
import { isCrazyGamesFullRelease } from '@/use/useMatch'
import type { AdProvider } from './types'

export const createCrazyGamesProvider = (): AdProvider => ({
  name: 'crazygames',
  // Mirror the original gate: placements used to check
  // `isSdkActive && isCrazyGamesFullRelease` directly — keep that exact
  // truth-value so the CG build behaves identically.
  isReady: computed(() => isSdkActive.value && isCrazyGamesFullRelease),
  init: async () => {
  },
  showRewardedAd,
  showMidgameAd
})
