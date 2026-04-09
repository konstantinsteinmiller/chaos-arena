<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import useUser from '@/use/useUser'
import { mobileCheck } from '@/utils/function'
import {
  isSdkActive,
  isSdkMuted,
  addCrazyMuteListener,
  setCrazyMuted
} from '@/use/useCrazyGames'

const { userSoundVolume, userMusicVolume, setSettingValue } = useUser()

const isMuted = computed(() => userMusicVolume.value === 0 && userSoundVolume.value === 0)

// Store previous volumes to restore them when unmuting
const prevMusicVol = ref(userMusicVolume.value || 0.15)
const prevSoundVol = ref(userSoundVolume.value || 0.7)

/**
 * Apply a mute state to the local volume settings without touching the
 * CrazyGames SDK. Used both by the click handler and by the SDK→app
 * listener so external mute toggles (e.g. CrazyGames iframe chrome) flow
 * back into the in-game audio.
 */
const applyMute = (muted: boolean) => {
  if (muted && !isMuted.value) {
    prevMusicVol.value = userMusicVolume.value
    prevSoundVol.value = userSoundVolume.value
    setSettingValue('music', 0)
    setSettingValue('sound', 0)
  } else if (!muted && isMuted.value) {
    setSettingValue('music', prevMusicVol.value || 0.5)
    setSettingValue('sound', prevSoundVol.value || 0.7)
  }
}

const toggleMute = () => {
  const next = !isMuted.value
  applyMute(next)
  // Mirror the change back to the SDK so the platform-level mute UI
  // (CrazyGames chrome) stays in sync. No-op outside crazy-web builds.
  setCrazyMuted(next)
}

let removeMuteListener: (() => void) | null = null
onMounted(() => {
  if (!isSdkActive.value) return
  // Adopt the SDK's initial mute state if it differs from ours, so the
  // game starts the session matching the platform's preference.
  if (isSdkMuted.value !== null && isSdkMuted.value !== isMuted.value) {
    applyMute(isSdkMuted.value)
  }
  // Listen for SDK-side mute toggles for the rest of the session.
  removeMuteListener = addCrazyMuteListener((muted) => applyMute(muted))
})
onUnmounted(() => {
  removeMuteListener?.()
  removeMuteListener = null
})
</script>

<template lang="pug">
  div.flex.flex-col.items-end.gap-1
    button.p-2.rounded-full.backdrop-blur-sm.transition-all.cursor-pointer(
      v-if="!mobileCheck()"
      class="bg-black/20 hover:bg-black/40 active:scale-95 pointer-events-auto"
      @click="toggleMute"
    )
      span.text-2xl {{ isMuted ? '🔇': '🔊' }}
</template>

<style scoped lang="sass">

</style>