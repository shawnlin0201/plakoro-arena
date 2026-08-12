<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

const battle = inject('battle')
const { t } = useI18n()
const cutIn = computed(() => battle.state.turnCutIn)
const trainerName = computed(() => t(`player.trainer${cutIn.value.key}`))
const energyIcons = computed(() => Array.from({ length: cutIn.value.energyCount }, (_, i) => (i % 6) + 1))
</script>

<template>
  <div class="turn-cutin" :class="cutIn.key === 'A' ? 'cutin-a' : 'cutin-b'">
    <div class="turn-cutin-backdrop"></div>
    <div class="turn-cutin-line1">{{ trainerName }}</div>
    <div class="turn-cutin-line2">
      <template v-if="cutIn.hasChara">
        <div class="tc-icon"><img :src="'/image/ICON/キャラコロ.png'" class="img-icon" alt="キャラコロ"></div>
        <span v-if="cutIn.energyCount > 0" class="tc-flow"></span>
      </template>
      <div v-for="(num, i) in energyIcons" :key="i" class="tc-icon"><img :src="`/image/ICON/エネコロ${num}.png`" class="img-icon" alt="エネコロ"></div>
    </div>
  </div>
</template>
