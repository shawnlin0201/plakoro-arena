<script setup>
// Who you are, in the corner of the home screen — just the face.
//
// Nothing signs in yet, so today this is the default artwork. It is here now because the
// space it occupies is a layout decision, and because the day accounts arrive only
// `currentPlayer` has to change.
//
// A button now that there is a profile screen behind it.
import { useI18n } from 'vue-i18n'
import { currentIdentity, isSignedIn } from '../data/currentPlayer'
import { avatarUrl } from '../data/nameplateAssets'

const emit = defineEmits(['open'])
const { t } = useI18n()
</script>

<template>
  <button class="player-chip" :aria-label="t('profile.title')" @click="emit('open')">
    <img class="pc-avatar" :src="avatarUrl(currentIdentity.avatar)" alt="" aria-hidden="true">
    <span class="pc-name">{{ isSignedIn ? currentIdentity.name : t('player.guest') }}</span>
  </button>
</template>

<style scoped>
/* No plate behind it. The avatar and the name sit straight on the board — a backing pill only
   added a second shape to look at in a corner that should be glanceable. */
.player-chip {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 300;
  display: flex;
  /* Top-aligned, not centred: the name reads as a caption the avatar carries, and centring it
     against a 3.5rem square left it floating in the middle of nothing. */
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.player-chip:active { transform: scale(.97); }
.player-chip:focus-visible { outline: 0.125rem solid var(--accent-strong); outline-offset: 0.1875rem; border-radius: 0.5rem; }

.pc-avatar {
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 0.4375rem;
  /* contain, not cover: the artwork is composed as a whole square and cropping it would cut
     the edges of whatever a player has chosen to represent them. */
  object-fit: contain;
  /* A hairline rather than a border: enough to separate the artwork from the board without
     reading as a frame around it. */
  box-shadow: 0 0 0 0.0625rem rgba(255, 255, 255, .5), 0 0.0625rem 0.25rem rgba(60, 60, 50, .25);
}

/* Dark on the board, not white on a pill — there is no pill to be white against. */
.pc-name {
  /* Nudged down so its cap-height lines up with the top edge of the avatar rather than
     hanging above it. */
  padding-top: 0.125rem;
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 9rem;
}
</style>
