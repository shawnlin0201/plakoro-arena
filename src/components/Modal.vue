<script setup>
import { inject } from 'vue'
import CharSelectModal from './CharSelectModal.vue'
import MoveSelectModal from './MoveSelectModal.vue'

const battle = inject('battle')
const state = battle.state
</script>

<template>
  <div class="modal-overlay" @click.self="battle.closeModal()">
    <div class="modal-sheet">
      <CharSelectModal v-if="state.modal.type === 'char'" />
      <MoveSelectModal v-else-if="state.modal.type === 'move'" />
    </div>
  </div>
</template>
