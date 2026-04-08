<script setup lang="ts">
import useUser from '@/use/useUser'
import { mobileCheck } from '@/utils/function'

const { userSoundVolume, userMusicVolume, setSettingValue } = useUser()

// Logic to determine if muted based on current volumes
import { computed, ref } from 'vue'

const isMuted = computed(() => userMusicVolume.value === 0 && userSoundVolume.value === 0)

// Store previous volumes to restore them when unmuting
const prevMusicVol = ref(userMusicVolume.value || 0.5)
const prevSoundVol = ref(userSoundVolume.value || 0.7)

const toggleMute = () => {
  if (!isMuted.value) {
    // Save current values before muting
    prevMusicVol.value = userMusicVolume.value
    prevSoundVol.value = userSoundVolume.value
    // Mute
    setSettingValue('music', 0)
    setSettingValue('sound', 0)
  } else {
    // Restore previous values (or defaults if previous was somehow 0)
    setSettingValue('music', prevMusicVol.value || 0.5)
    setSettingValue('sound', prevSoundVol.value || 0.7)
  }
}
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