<script setup>
import SoloPlayerCard from './SoloPlayerCard.vue'
</script>

<template>
  <div class="board turn-board">
    <div class="player-row turn-row">
      <SoloPlayerCard who="player" />
      <SoloPlayerCard who="ai" />
    </div>
  </div>
</template>
