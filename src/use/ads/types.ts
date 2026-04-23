// Provider-agnostic ad surface. Every platform-specific ad backend
// (CrazyGames SDK, Unity LevelPlay via the Tauri mobile plugin, etc.)
// implements this interface so the four in-game ad placements
// (midgame interstitial, AdRewardButton, RouletteWheel respin, 2x
// speed-boost reward) never have to know which provider is active.
//
// Contract notes:
//   • `isReady` must stay reactive — placements use it as their v-if gate.
//     A provider that hasn't finished init MUST expose `isReady.value = false`
//     so the gate hides ad UI instead of showing broken buttons.
//   • `showRewardedAd` resolves `true` only if the video played all the way
//     through — callers grant the reward only on `true`.
//   • `showMidgameAd` resolves when the interstitial finished or errored.
//     It never rejects: callers `await` it and then resume gameplay.
//   • `init` is idempotent and safe to call when the provider is inert
//     (e.g. Noop on unsupported platforms).
import type { Ref } from 'vue'

export interface AdProvider {
  /** Human-readable name for logs / telemetry. */
  readonly name: string
  /** Reactive gate for ad UI. */
  readonly isReady: Ref<boolean>
  init: () => Promise<void>
  showRewardedAd: () => Promise<boolean>
  showMidgameAd: () => Promise<void>
}
