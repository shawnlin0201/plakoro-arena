<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadTournaments, saveTournament, deleteTournament } from '../../data/tournaments'
import { pairSwissRound, pairEliminationRound, isTournamentComplete, assignTableNumbers } from '../../game/tournamentPairing'
import TournamentSetup from './TournamentSetup.vue'
import TournamentDetail from './TournamentDetail.vue'

const emit = defineEmits(['back'])
const { t } = useI18n()

const view = ref('list') // 'list' | 'setup' | 'detail'
const tournaments = ref(loadTournaments())
const activeTournament = ref(null)
const confirmDeleteId = ref(null)

function openTournament(tour) {
  activeTournament.value = tour
  view.value = 'detail'
}

// Pairing generates round 1 here, not inside TournamentSetup — that component stays a plain
// form with zero knowledge of pairing logic.
function onCreated(shell) {
  const round = shell.format === 'swiss' ? pairSwissRound(shell) : pairEliminationRound(shell)
  if (round) assignTableNumbers(shell, round)
  shell.rounds = round ? [round] : []
  saveTournament(shell)
  tournaments.value.push(shell)
  openTournament(shell)
}

function onUpdate(updated) {
  saveTournament(updated)
  const idx = tournaments.value.findIndex(x => x.id === updated.id)
  if (idx >= 0) tournaments.value[idx] = updated
  activeTournament.value = updated
}

function confirmDelete() {
  deleteTournament(confirmDeleteId.value)
  tournaments.value = tournaments.value.filter(x => x.id !== confirmDeleteId.value)
  confirmDeleteId.value = null
}

function statusLabel(tour) {
  return isTournamentComplete(tour) ? t('tournament.statusComplete') : t('tournament.statusInProgress')
}
</script>

<template>
  <TournamentSetup v-if="view === 'setup'" @created="onCreated" @back="view = 'list'" />

  <TournamentDetail
    v-else-if="view === 'detail' && activeTournament"
    :key="activeTournament.id"
    :tournament="activeTournament"
    @update="onUpdate"
    @back="view = 'list'"
  />

  <div v-else class="board select-board" style="display:flex; flex-direction:column; min-height:0;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem; flex-shrink:0;">{{ t('tournament.listTitle') }}</div>

    <div style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem; padding:0 0.625rem;">
      <div v-if="tournaments.length === 0" style="text-align:center; padding:1rem; color:var(--sub); font-size:0.875rem;">{{ t('tournament.empty') }}</div>

      <div
        v-for="tour in tournaments"
        :key="tour.id"
        style="background:var(--card); border-radius:0.75rem; box-shadow:var(--shadow); padding:0.625rem 0.75rem; display:flex; align-items:center; gap:0.5rem; cursor:pointer;"
        @click="openTournament(tour)"
      >
        <div style="flex:1; min-width:0;">
          <div style="font-size:0.875rem; font-weight:800; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ tour.name }}</div>
          <div style="font-size:0.6875rem; color:var(--sub);">
            {{ t('tournament.format.' + tour.format) }} · {{ t('tournament.playerCount', { n: tour.players.length }) }} · {{ statusLabel(tour) }}
          </div>
        </div>
        <button class="btn secondary" style="padding:0.375rem 0.625rem; font-size:0.75rem; flex-shrink:0;" @click.stop="confirmDeleteId = tour.id">{{ t('tournament.delete') }}</button>
      </div>
    </div>

    <div style="display:flex; gap:0.625rem; justify-content:center; padding:0.75rem 0 0.25rem; flex-shrink:0;">
      <button class="btn" @click="view = 'setup'">{{ t('tournament.newTournament') }}</button>
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>

    <div v-if="confirmDeleteId" class="modal-overlay" style="align-items:center;" @click.self="confirmDeleteId = null">
      <div style="background:var(--bg); border-radius:1.125rem; box-shadow:var(--shadow); padding:1.25rem 1.5rem; max-width:22rem; display:flex; flex-direction:column; align-items:center; gap:0.75rem; text-align:center;">
        <div style="font-size:0.75rem; color:var(--sub); line-height:1.6;">
          {{ t('tournament.deleteConfirm', { name: tournaments.find(x => x.id === confirmDeleteId)?.name || '' }) }}
        </div>
        <div style="display:flex; gap:0.625rem; justify-content:center;">
          <button class="btn secondary" @click="confirmDeleteId = null">{{ t('common.cancel') }}</button>
          <button class="btn fail" @click="confirmDelete">{{ t('tournament.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
