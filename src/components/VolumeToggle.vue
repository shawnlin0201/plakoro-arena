<!-- The quick-access icon in GlobalTopBar.vue — clicking it opens/closes the music player panel
     (MusicPlayer.vue). It is not a switch: transport and mute are both controls inside that
     panel. What it does do is report, so the icon and the click answer two different questions
     — the icon says whether sound is coming out right now, the click opens the place to change
     that.

     "Sound is coming out" is playing AND not muted, because there are two ways to be silent
     now that nothing starts on its own, and an icon that only knew about mute would show an
     open speaker over silence. -->
<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { audioSettings } from '../data/audioSettings'
import { toggleMusicPlayer } from '../data/musicPlayerUi'
import Icon from './Icon.vue'
import { isPlaying } from '../data/backgroundMusic'

const { t } = useI18n()
const audible = computed(() => isPlaying.value && !audioSettings.value.muted)
</script>

<template>
  <button
    class="volume-toggle"
    :aria-label="t('app.musicPlayer')"
    @click="toggleMusicPlayer"
  ><Icon :name="audible ? 'volume' : 'volume-off'" /></button>
</template>

<style scoped>
.volume-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 0.4375rem;
  background: rgba(0, 0, 0, .35);
  color: #fff;
  font-size: 0.9375rem;
  line-height: 1;
  cursor: pointer;
}
</style>
