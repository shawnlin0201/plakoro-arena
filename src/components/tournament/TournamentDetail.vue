<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  computeStandings,
  pairSwissRound,
  pairEliminationRound,
  isTournamentComplete,
  isRoundComplete,
  championOf,
  assignTableNumbers
} from '../../game/tournamentPairing'
import TournamentLottery from './TournamentLottery.vue'

const props = defineProps({ tournament: { type: Object, required: true } })
const emit = defineEmits(['update', 'back'])
const { t } = useI18n()

// A local, mutable copy — TournamentApp gives this component a fresh instance (via :key) every
// time the active tournament changes, so cloning once here is enough; mutating a prop directly
// would trip Vue's dev warnings. JSON round-trip rather than structuredClone(): the prop is a Vue
// reactive Proxy, and structuredClone can't clone that directly ("could not be cloned") — JSON
// serialization reads through the proxy via normal property access instead, and the tournament
// data is already proven JSON-safe since it's persisted the same way in tournaments.js.
const local = ref(JSON.parse(JSON.stringify(props.tournament)))
// Swiss: 'round' | 'standings' | 'history' | 'players'. Elimination: 'round' | 'bracket' |
// 'players' ('bracket' already covers "history" — every round's matches across the whole
// tournament — so it gets no separate history tab of its own).
const subview = ref('round')
const lotteryRef = ref(null)

// Renaming the tournament or a player: clicking the text itself enters edit mode, and
// committing (Enter or clicking away) opens a confirm popup rather than saving immediately —
// `confirmState` holds the pending change until the organizer explicitly confirms it.
const editingName = ref(false)
const nameDraft = ref('')
const editingPlayerId = ref(null)
const editingPlayerName = ref('')
const confirmState = ref(null) // { kind: 'name' | 'player', playerId?, newValue }

function startEditName() {
  nameDraft.value = local.value.name
  editingName.value = true
}

// Bound to both @keyup.enter and @blur on the input — whichever fires first opens the confirm
// popup (or, if the value didn't actually change, just exits edit mode); the guard below stops
// the other one from re-triggering once a popup is already pending (e.g. blur firing because
// focus moved to the popup's own buttons).
function requestSaveName() {
  if (!editingName.value || confirmState.value) return
  const trimmed = nameDraft.value.trim()
  if (!trimmed || trimmed === local.value.name) { editingName.value = false; return }
  confirmState.value = { kind: 'name', newValue: trimmed }
}

function startEditPlayer(p) {
  editingPlayerId.value = p.id
  editingPlayerName.value = p.name
}

function requestSavePlayer() {
  if (editingPlayerId.value === null || confirmState.value) return
  const p = local.value.players.find(x => x.id === editingPlayerId.value)
  const trimmed = editingPlayerName.value.trim()
  if (!p || !trimmed || trimmed === p.name) { editingPlayerId.value = null; return }
  confirmState.value = { kind: 'player', playerId: p.id, newValue: trimmed }
}

function confirmEdit() {
  if (!confirmState.value) return
  if (confirmState.value.kind === 'name') {
    local.value.name = confirmState.value.newValue
    editingName.value = false
  } else {
    const p = local.value.players.find(x => x.id === confirmState.value.playerId)
    if (p) p.name = confirmState.value.newValue
    editingPlayerId.value = null
  }
  confirmState.value = null
  emitUpdate()
}

function cancelEdit() {
  // Exits edit mode outright rather than leaving the input focused with the typed draft — since
  // the draft was never written back to local.value, this already reverts to the original name;
  // dropping out of edit mode is what actually removes the input's focus.
  if (confirmState.value?.kind === 'name') editingName.value = false
  else if (confirmState.value?.kind === 'player') editingPlayerId.value = null
  confirmState.value = null
}

function playerName(id) {
  if (!id) return ''
  const p = local.value.players.find(p => p.id === id)
  return p ? p.name : '?'
}

// Highlights the winner and mutes the loser in a read-only match row; both stay neutral while
// undecided or drawn.
function nameColor(match, side) {
  if (!match.result || match.result === 'draw') return 'var(--ink)'
  return side === match.result ? 'var(--ink)' : 'var(--sub)'
}

const currentRound = computed(() => local.value.rounds[local.value.rounds.length - 1] || null)
const complete = computed(() => isTournamentComplete(local.value))
const standings = computed(() => computeStandings(local.value))
// Players in standings order (best rank first) — used for the lottery's eligibility list and
// wheel, so it reads the same way the organizer already sees rank in the standings table.
const playersByStandings = computed(() => {
  const byId = new Map(local.value.players.map(p => [p.id, p]))
  return standings.value.map(s => byId.get(s.playerId)).filter(Boolean)
})
const champion = computed(() => championOf(local.value))
const canGenerateNext = computed(() => !complete.value && !!currentRound.value && isRoundComplete(currentRound.value))

function emitUpdate() {
  emit('update', local.value)
}

// Only the current round's results are editable — reaching back into an already-superseded
// round is a rarer need, and for elimination it would require re-deriving every later round,
// which is a deliberate v1 simplification (see the plan).
function recordResult(match, result) {
  match.result = result
  emitUpdate()
}

let generating = false
function generateNextRound() {
  if (generating || !canGenerateNext.value) return
  generating = true
  try {
    const round = local.value.format === 'swiss' ? pairSwissRound(local.value) : pairEliminationRound(local.value)
    if (round) {
      // Table numbers must be stamped now, from standings as of right before this round —
      // never recomputed later, or they'd reshuffle live as results get recorded this round.
      assignTableNumbers(local.value, round)
      local.value.rounds.push(round)
      emitUpdate()
    }
  } finally {
    generating = false
  }
}
</script>

<template>
  <div class="board select-board" style="display:flex; flex-direction:column; min-height:0;">
    <!-- Title and view tabs share a row — a separate tab row ate into the vertical space the
         main content area needed. The title shrinks/truncates first if the two don't both fit. -->
    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.375rem; flex-shrink:0; padding:0.375rem 0.625rem 0.25rem;">
      <input
        v-if="editingName"
        v-model="nameDraft"
        autofocus
        @keyup.enter="requestSaveName"
        @blur="requestSaveName"
        style="flex:1; min-width:0; font-size:0.8125rem; font-weight:800; padding:0.25rem 0.375rem; border-radius:0.375rem; border:0.125rem solid var(--line); color:var(--ink);"
      >
      <div
        v-else
        class="modal-title"
        style="font-size:0.8125rem; margin:0; text-align:left; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;"
        @click="startEditName"
      >{{ local.name }}</div>
      <button :class="['btn', subview === 'round' ? '' : 'secondary']" style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;" @click="subview = 'round'">
        {{ t('tournament.detail.roundTab') }}
      </button>
      <template v-if="local.format === 'swiss'">
        <button
          :class="['btn', subview === 'standings' ? '' : 'secondary']"
          style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;"
          @click="subview = 'standings'"
        >{{ t('tournament.detail.standingsTab') }}</button>
        <button
          :class="['btn', subview === 'history' ? '' : 'secondary']"
          style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;"
          @click="subview = 'history'"
        >{{ t('tournament.detail.historyTab') }}</button>
      </template>
      <button
        v-else
        :class="['btn', subview === 'bracket' ? '' : 'secondary']"
        style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;"
        @click="subview = 'bracket'"
      >{{ t('tournament.detail.bracketTab') }}</button>
      <button
        :class="['btn', subview === 'players' ? '' : 'secondary']"
        style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;"
        @click="subview = 'players'"
      >{{ t('tournament.detail.playersTab') }}</button>
      <button
        :class="['btn', subview === 'lottery' ? '' : 'secondary']"
        style="flex-shrink:0; padding:0.4375rem 0.5rem; font-size:0.6875rem;"
        @click="subview = 'lottery'"
      >{{ t('tournament.detail.lotteryTab') }}</button>
    </div>

    <div style="flex:1; min-height:0; overflow-y:auto; padding:0 0.625rem;">
      <!-- Current round — a table row per match rather than a stack of cards, so it doesn't
           spread out the whole page. -->
      <div v-if="subview === 'round' && currentRound" style="overflow-x:auto;">
        <div style="font-size:0.75rem; font-weight:800; color:var(--sub); margin-bottom:0.375rem;">{{ t('tournament.roundLabel', { n: currentRound.roundNumber }) }}</div>
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
          <tbody>
            <tr v-for="m in currentRound.matches" :key="m.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:0.5rem 0.375rem; color:var(--sub); white-space:nowrap;">
                {{ m.table !== null ? t('tournament.detail.tableLabel', { n: m.table }) : t('tournament.detail.bye') }}
              </td>
              <td style="padding:0.5rem 0.5rem; font-weight:700; color:var(--ink);">
                <template v-if="m.player2Id === null">{{ playerName(m.player1Id) }}</template>
                <template v-else>
                  {{ playerName(m.player1Id) }} vs {{ playerName(m.player2Id) }}
                  <span v-if="m.rematch" style="display:inline-block; font-size:0.625rem; font-weight:800; color:#fff; background:var(--danger); border-radius:0.5rem; padding:0.125rem 0.4375rem; margin-left:0.25rem;">{{ t('tournament.detail.rematchBadge') }}</span>
                </template>
              </td>
              <td v-if="m.player2Id !== null" style="padding:0.375rem 0.25rem; white-space:nowrap;">
                <button :class="['btn', m.result === 'p1' ? '' : 'secondary']" style="padding:0.25rem 0.375rem; font-size:0.625rem;" @click="recordResult(m, 'p1')">{{ t('tournament.detail.resultP1') }}</button>
                <button v-if="local.format === 'swiss'" :class="['btn', m.result === 'draw' ? '' : 'secondary']" style="padding:0.25rem 0.375rem; font-size:0.625rem;" @click="recordResult(m, 'draw')">{{ t('tournament.detail.resultDraw') }}</button>
                <button :class="['btn', m.result === 'p2' ? '' : 'secondary']" style="padding:0.25rem 0.375rem; font-size:0.625rem;" @click="recordResult(m, 'p2')">{{ t('tournament.detail.resultP2') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Swiss standings — ranked by points, then the official Play! Pokemon tiebreakers
           (OMW%, then OOMW%). Wrapped in horizontal scroll now that it's 6 columns wide. -->
      <div v-else-if="subview === 'standings'" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; white-space:nowrap;">
          <thead>
            <tr style="text-align:left; border-bottom:2px solid var(--line);">
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.rank') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.name') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.points') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.record') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.omwp') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.standingsHeaders.oomwp') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in standings" :key="s.playerId" style="border-bottom:1px solid var(--line);">
              <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ i + 1 }}</td>
              <td style="padding:0.375rem 0.5rem; font-weight:800;">{{ s.name }}</td>
              <td style="padding:0.375rem 0.5rem; font-weight:800;">{{ s.points }}</td>
              <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ s.wins }}-{{ s.draws }}-{{ s.losses }}</td>
              <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ (s.omwp * 100).toFixed(1) }}%</td>
              <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ (s.oomwp * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Swiss match history — every round's pairings and results, read-only, as a flat table
           (most recent round first) so it doesn't spread out the whole page either. -->
      <div v-else-if="subview === 'history'" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
          <thead>
            <tr style="text-align:left; border-bottom:2px solid var(--line);">
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.historyHeaders.round') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.historyHeaders.match') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('tournament.detail.historyHeaders.result') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="round in [...local.rounds].reverse()" :key="round.roundNumber">
              <tr v-for="m in round.matches" :key="m.id" style="border-bottom:1px solid var(--line);">
                <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ round.roundNumber }}</td>
                <td style="padding:0.375rem 0.5rem; font-weight:700;">
                  <template v-if="m.player2Id === null">{{ playerName(m.player1Id) }}</template>
                  <template v-else>
                    <span :style="{ color: nameColor(m, 'p1') }">{{ playerName(m.player1Id) }}</span>
                    <span style="color:var(--sub); font-weight:400;"> vs </span>
                    <span :style="{ color: nameColor(m, 'p2') }">{{ playerName(m.player2Id) }}</span>
                  </template>
                </td>
                <td style="padding:0.375rem 0.5rem; color:var(--sub);">
                  <template v-if="m.player2Id === null">{{ t('tournament.detail.bye') }}</template>
                  <template v-else-if="m.result === 'draw'">{{ t('tournament.detail.resultDraw') }}</template>
                  <template v-else-if="m.result === 'p1'">{{ playerName(m.player1Id) }}</template>
                  <template v-else-if="m.result === 'p2'">{{ playerName(m.player2Id) }}</template>
                  <span v-if="m.rematch" style="font-size:0.625rem; font-weight:800; color:#fff; background:var(--danger); border-radius:0.5rem; padding:0.125rem 0.4375rem; margin-left:0.25rem;">{{ t('tournament.detail.rematchBadge') }}</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Player roster — rename anyone who registered under the wrong name/nickname. Renaming
           is safe at any point: matches/results are keyed by player id, never by name. -->
      <div v-else-if="subview === 'players'" style="display:flex; flex-direction:column; gap:0.375rem;">
        <div
          v-for="p in local.players"
          :key="p.id"
          style="display:flex; align-items:center; gap:0.5rem; background:var(--card); border-radius:0.5rem; box-shadow:var(--shadow); padding:0.5rem 0.625rem;"
        >
          <input
            v-if="editingPlayerId === p.id"
            v-model="editingPlayerName"
            autofocus
            @keyup.enter="requestSavePlayer"
            @blur="requestSavePlayer"
            style="flex:1; min-width:0; font-size:0.8125rem; font-weight:700; padding:0.25rem 0.375rem; border-radius:0.375rem; border:0.125rem solid var(--line); color:var(--ink);"
          >
          <span
            v-else
            style="flex:1; min-width:0; font-size:0.8125rem; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;"
            @click="startEditPlayer(p)"
          >{{ p.name }}</span>
        </div>
      </div>

      <!-- Prize draw wheel — a separate component since it's a genuinely distinct little tool
           (its own animation/state), not part of the tournament's core pairing data. -->
      <TournamentLottery v-else-if="subview === 'lottery'" ref="lotteryRef" :players="playersByStandings" />

      <!-- Elimination bracket (read-only history across all rounds) -->
      <div v-else-if="subview === 'bracket'" style="display:flex; gap:0.625rem; overflow-x:auto; padding-bottom:0.5rem;">
        <div v-for="round in local.rounds" :key="round.roundNumber" style="min-width:7.5rem; flex-shrink:0; display:flex; flex-direction:column; gap:0.375rem;">
          <div style="font-size:0.6875rem; font-weight:800; color:var(--sub); text-align:center;">{{ t('tournament.roundLabel', { n: round.roundNumber }) }}</div>
          <div
            v-for="m in round.matches"
            :key="m.id"
            style="background:var(--card); border-radius:0.5rem; box-shadow:var(--shadow); padding:0.375rem 0.5rem; font-size:0.6875rem; font-weight:700; color:var(--ink);"
          >
            <div v-if="m.player2Id === null">{{ playerName(m.player1Id) }} ({{ t('tournament.detail.bye') }})</div>
            <template v-else>
              <div :style="{ color: m.result === 'p1' ? 'var(--ink)' : 'var(--sub)' }">{{ playerName(m.player1Id) }}</div>
              <div :style="{ color: m.result === 'p2' ? 'var(--ink)' : 'var(--sub)' }">{{ playerName(m.player2Id) }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; align-items:center; gap:0.375rem; padding:0.375rem 0 0.25rem; flex-shrink:0;">
      <div v-if="champion" style="font-size:0.8125rem; font-weight:800; color:var(--ink);">
        {{ t('tournament.detail.champion', { name: champion.name }) }}
      </div>
      <div style="display:flex; gap:0.625rem;">
        <button v-if="!complete" class="btn" style="padding:0.5rem 0.875rem; font-size:0.8125rem;" :disabled="!canGenerateNext" @click="generateNextRound">{{ t('tournament.detail.generateNextRound') }}</button>
        <button
          v-if="subview === 'lottery'"
          class="btn"
          style="padding:0.5rem 0.875rem; font-size:0.8125rem;"
          :disabled="!lotteryRef?.canSpin || lotteryRef?.spinning"
          @click="lotteryRef.startSpin()"
        >{{ t('tournament.detail.drawButton') }}</button>
        <button class="btn secondary" style="padding:0.5rem 0.875rem; font-size:0.8125rem;" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </div>

    <div v-if="confirmState" class="modal-overlay" style="align-items:center;" @click.self="cancelEdit">
      <div style="background:var(--bg); border-radius:1.125rem; box-shadow:var(--shadow); padding:1.25rem 1.5rem; max-width:22rem; display:flex; flex-direction:column; align-items:center; gap:0.75rem; text-align:center;">
        <div style="font-size:0.8125rem; font-weight:700; color:var(--ink); line-height:1.6;">
          {{ confirmState.kind === 'name'
            ? t('tournament.detail.confirmRenameTournament', { name: confirmState.newValue })
            : t('tournament.detail.confirmRenamePlayer', { name: confirmState.newValue }) }}
        </div>
        <div style="display:flex; gap:0.625rem; justify-content:center;">
          <button class="btn secondary" @click="cancelEdit">{{ t('common.cancel') }}</button>
          <button class="btn" @click="confirmEdit">{{ t('common.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
