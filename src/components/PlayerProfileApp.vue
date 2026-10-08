<script setup>
// Your own player profile: the face, the flag, and the name you go by.
//
// Only the things a player chooses. Medals, titles and win rates are not here and will never
// be — those are read off the tournament records, and a profile screen that could set them
// would make every badge in the app worthless.
//
// Local for now. There are no accounts, so this edits what this browser remembers; when
// signing in exists, the same fields become what gets saved against the account.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { currentIdentity, setCurrentPlayer } from '../data/currentPlayer'
import { AVATAR_IDS, BACKGROUND_IDS, avatarUrl, backgroundUrl } from '../data/nameplateAssets'
import { TITLE_GROUPS, resolveTitle } from '../data/titleCatalogue'
import PlayerBanner from './tournament/PlayerBanner.vue'

const emit = defineEmits(['back'])
const { t } = useI18n()

// A draft, so backing out leaves the saved profile alone.
const draft = ref({
  code: currentIdentity.value.code,
  name: currentIdentity.value.name || '',
  avatar: currentIdentity.value.avatar,
  background: currentIdentity.value.background || BACKGROUND_IDS[0],
  titleId: currentIdentity.value.titleId || null
})

// The real nameplate component, fed the draft — so what is being previewed is the thing that
// will appear beside this player's name at an event, not an approximation of it.
const preview = computed(() => ({
  playerKey: draft.value.code ? `code:${draft.value.code}` : 'local',
  name: draft.value.name.trim() || t('player.guest'),
  code: draft.value.code,
  avatar: draft.value.avatar,
  background: draft.value.background,
  title: resolveTitle(draft.value.titleId),
  // Earned, so the preview shows them as they really are: empty, until an event says otherwise.
  medals: { gold: 0, silver: 0, bronze: 0 },
  events: 0,
  winRate: null
}))

const dirty = computed(() =>
  draft.value.name.trim() !== (currentIdentity.value.name || '') ||
  draft.value.avatar !== currentIdentity.value.avatar ||
  draft.value.background !== (currentIdentity.value.background || BACKGROUND_IDS[0]) ||
  draft.value.titleId !== (currentIdentity.value.titleId || null))

function save() {
  setCurrentPlayer({
    code: draft.value.code || 'LOCAL',
    name: draft.value.name.trim(),
    avatar: draft.value.avatar,
    background: draft.value.background,
    titleId: draft.value.titleId
  })
  emit('back')
}
</script>

<template>
  <div class="board select-board pp-board">
    <div class="modal-title pp-title">{{ t('profile.title') }}</div>

    <!-- Outside the scroller: the preview is what every choice below is being judged against,
         so scrolling it away would mean picking a flag with nothing to check it on. -->
    <div class="pp-preview">
      <PlayerBanner :nameplate="preview" />
    </div>

    <div class="pp-body">
      <label class="pp-field">
        <span class="pp-label">{{ t('profile.name') }}</span>
        <input
          v-model="draft.name"
          class="pp-input"
          maxlength="20"
          :placeholder="t('profile.namePlaceholder')"
        >
      </label>

      <div class="pp-field">
        <span class="pp-label">{{ t('profile.avatar') }}</span>
        <div class="pp-grid">
          <button
            v-for="id in AVATAR_IDS"
            :key="id"
            :class="['pp-swatch', { on: draft.avatar === id }]"
            :title="id"
            @click="draft.avatar = id"
          >
            <img :src="avatarUrl(id)" alt="" loading="lazy">
          </button>
        </div>
      </div>

      <div class="pp-field">
        <span class="pp-label">{{ t('profile.flag') }}</span>
        <div class="pp-grid wide">
          <button
            v-for="id in BACKGROUND_IDS"
            :key="id"
            :class="['pp-swatch', 'flag', { on: draft.background === id }]"
            :title="id"
            @click="draft.background = id"
          >
            <img :src="backgroundUrl(id)" alt="" loading="lazy">
          </button>
        </div>
      </div>

      <div class="pp-field">
        <span class="pp-label">{{ t('profile.titleLabel') }}</span>
        <div class="pp-titles">
          <button
            :class="['pp-title-chip', 'plain', { on: draft.titleId === null }]"
            @click="draft.titleId = null"
          >{{ t('profile.noTitle') }}</button>
        </div>
        <!-- Grouped by the event that awards them, because that is how a player thinks of
             what they hold: "the ones I got at Meetup#2". -->
        <div v-for="g in TITLE_GROUPS" :key="g.key" class="pp-series">
          <span class="pp-series-label">{{ g.label }}</span>
          <div class="pp-titles">
            <button
              v-for="ti in g.titles"
              :key="ti.id"
              :class="['pp-title-chip', ti.rank, { on: draft.titleId === ti.id }]"
              :title="ti.condition || undefined"
              @click="draft.titleId = ti.id"
            >{{ ti.text }}</button>
          </div>
        </div>
      </div>

      <!-- Said plainly: nothing here is a claim about results. -->
      <p class="pp-note">{{ t('profile.earnedNote') }}</p>
    </div>

    <div class="pp-foot">
      <button class="btn" :disabled="!dirty" @click="save">{{ t('profile.save') }}</button>
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>
</template>

<style scoped>
.pp-board { display: flex; flex-direction: column; min-height: 0; }
.pp-title { margin: 0.5rem 0 0.25rem; flex-shrink: 0; }

.pp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.pp-preview {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 0.25rem 0 0.5rem;
}

.pp-field { width: 100%; max-width: 26rem; display: flex; flex-direction: column; gap: 0.25rem; }
.pp-label { font-size: 0.625rem; font-weight: 800; color: var(--sub); letter-spacing: 0.04em; }

.pp-input {
  width: 100%;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--ink);
  padding: 0.4375rem 0.5rem;
  border: 0.125rem solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--card);
}
.pp-input:focus { outline: none; border-color: var(--accent-strong); }

.pp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
  gap: 0.375rem;
}
.pp-grid.wide { grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); }

.pp-swatch {
  padding: 0;
  border: 0.125rem solid transparent;
  border-radius: var(--radius-sm);
  background: var(--card);
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 1;
  box-shadow: var(--shadow);
}
/* 8:3, so a flag reads as the shape it will actually be rather than a cropped square. */
.pp-swatch.flag { aspect-ratio: 8 / 3; }
.pp-swatch img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pp-swatch.on { border-color: var(--accent-strong); }
.pp-swatch:focus-visible { outline: 0.125rem solid var(--accent-strong); outline-offset: 0.125rem; }

/* Coloured the way the nameplate will colour them, so what is picked here is what appears
   there. Same ranks, same tints. */
.pp-series { display: flex; flex-direction: column; gap: 0.1875rem; padding-top: 0.25rem; }
.pp-series-label {
  font-size: 0.5rem;
  font-weight: 800;
  color: var(--sub);
  letter-spacing: 0.06em;
}
.pp-titles { display: flex; flex-wrap: wrap; gap: 0.25rem; }

.pp-title-chip {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  border: 0.125rem solid transparent;
  background: #2A2A28;
  color: var(--tint, rgba(255, 255, 255, .78));
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.pp-title-chip.on { border-color: var(--accent-strong); }
.pp-title-chip:focus-visible { outline: 0.125rem solid var(--accent-strong); outline-offset: 0.125rem; }
.pp-title-chip.plain  { --tint: rgba(255, 255, 255, .78); }
.pp-title-chip.silver { --tint: #D5DAE3; }
.pp-title-chip.bronze { --tint: #DB9A68; }
.pp-title-chip.epic   { --tint: #CE93E8; }
.pp-title-chip.gold   { --tint: #F0C244; }
.pp-title-chip.legend { --tint: #FFDC73; }

.pp-note {
  margin: 0;
  max-width: 26rem;
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--sub);
  line-height: 1.7;
}

.pp-foot {
  flex-shrink: 0;
  display: flex;
  gap: 0.625rem;
  justify-content: center;
  padding: 0.75rem 0 0.25rem;
}
</style>
