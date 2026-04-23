// Fallback provider for builds without an ad backend (plain web, itch,
// wavedash, glitch, desktop electron, etc.). Every call is inert and
// `isReady` stays false, which hides ad UI via the v-if gates on the
// ad placements.
import { ref } from 'vue'
import type { AdProvider } from './types'

export const createNoopProvider = (): AdProvider => ({
  name: 'noop',
  isReady: ref(false),
  init: async () => {
  },
  showRewardedAd: async () => false,
  showMidgameAd: async () => {
  }
})
