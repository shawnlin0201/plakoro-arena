<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['created', 'back'])
const { t } = useI18n()

const name = ref('')
const format = ref('swiss')
const playersText = ref('')
const swissRounds = ref(1)
const roundsTouched = ref(false)
const showValidation = ref(false)

// Names are deliberately not deduped — two real players can share a nickname, and pairing/
// results are keyed off generated ids, not the name string.
const parsedPlayers = computed(() => playersText.value.split('\n').map(s => s.trim()).filter(Boolean))

const suggestedRounds = computed(() => Math.max(1, Math.ceil(Math.log2(Math.max(2, parsedPlayers.value.length)))))

// Keeps the field prefilled with a sensible default as the player list changes, but stops
// overwriting it the moment the organizer edits it themselves.
function onRoundsInput(e) {
  roundsTouched.value = true
  swissRounds.value = Math.max(1, Math.round(Number(e.target.value) || 1))
}

const effectiveRounds = computed(() => roundsTouched.value ? swissRounds.value : suggestedRounds.value)

const canSubmit = computed(() => parsedPlayers.value.length >= 2)

function submit() {
  if (!canSubmit.value) { showValidation.value = true; return }
  emit('created', {
    id: crypto.randomUUID(),
    name: name.value.trim() || t('tournament.setup.namePlaceholder'),
    format: format.value,
    createdAt: Date.now(),
    players: parsedPlayers.value.map(n => ({ id: crypto.randomUUID(), name: n })),
    rounds: [],
    swissTotalRounds: format.value === 'swiss' ? effectiveRounds.value : undefined
  })
}
</script>

<template>
  <div class="board select-board" style="display:flex; flex-direction:column; min-height:0;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem; flex-shrink:0;">{{ t('tournament.setup.title') }}</div>

    <div style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:0.75rem; padding:0 0.75rem;">
      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ t('tournament.setup.nameLabel') }}</span>
        <input
          v-model="name"
          type="text"
          :placeholder="t('tournament.setup.namePlaceholder')"
          style="font-size:0.875rem; font-weight:700; padding:0.5rem 0.625rem; border-radius:0.625rem; border:0.125rem solid var(--line); background:#fff; color:var(--ink);"
        >
      </div>

      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ t('tournament.setup.formatLabel') }}</span>
        <div style="display:flex; gap:0.5rem;">
          <button
            type="button"
            :class="['btn', format === 'swiss' ? '' : 'secondary']"
            style="flex:1;"
            @click="format = 'swiss'"
          >{{ t('tournament.format.swiss') }}</button>
          <button
            type="button"
            :class="['btn', format === 'elimination' ? '' : 'secondary']"
            style="flex:1;"
            @click="format = 'elimination'"
          >{{ t('tournament.format.elimination') }}</button>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ t('tournament.setup.playersLabel') }}</span>
        <textarea
          v-model="playersText"
          :placeholder="t('tournament.setup.playersPlaceholder')"
          rows="6"
          style="font-size:0.8125rem; font-weight:600; padding:0.5rem 0.625rem; border-radius:0.625rem; border:0.125rem solid var(--line); background:#fff; color:var(--ink); resize:vertical; font-family:inherit;"
        ></textarea>
        <span style="font-size:0.6875rem; color:var(--sub);">{{ t('tournament.setup.playersHint') }} · {{ t('tournament.playerCount', { n: parsedPlayers.length }) }}</span>
        <span v-if="showValidation && !canSubmit" style="font-size:0.6875rem; color:var(--danger); font-weight:800;">{{ t('tournament.setup.validationTooFewPlayers') }}</span>
      </div>

      <div v-if="format === 'swiss'" style="display:flex; flex-direction:column; gap:0.25rem;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ t('tournament.setup.roundsLabel') }}</span>
        <input
          type="number"
          min="1"
          :value="effectiveRounds"
          @input="onRoundsInput"
          style="font-size:0.875rem; font-weight:700; padding:0.5rem 0.625rem; border-radius:0.625rem; border:0.125rem solid var(--line); background:#fff; color:var(--ink); max-width:8rem;"
        >
        <span style="font-size:0.6875rem; color:var(--sub);">{{ t('tournament.setup.roundsHint') }}</span>
      </div>
    </div>

    <div style="display:flex; gap:0.625rem; justify-content:center; padding:0.875rem 0 0.25rem; flex-shrink:0;">
      <button class="btn" @click="submit">{{ t('tournament.setup.createButton') }}</button>
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>
</template>
