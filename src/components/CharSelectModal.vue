<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../data/constants'

const battle = inject('battle')
const { characters } = inject('characterData')
const { t } = useI18n()
const state = battle.state

function pick(c) {
  battle.openMoveSelect(state.modal.playerKey, c)
}
</script>

<template>
  <div class="modal-title">{{ t('charSelect.title') }}</div>
  <div v-if="characters.length === 0" style="text-align:center; color:var(--sub); font-size:12px; padding:16px 10px; line-height:1.6;">
    {{ t('charSelect.empty') }}
  </div>
  <div v-else class="grid-2">
    <div v-for="c in characters" :key="c.id" class="pick-card" @click="pick(c)">
      <div class="pick-top" :style="{ background: typeBgColor(c.type) }">
        <div class="pick-type-icon"><img :src="`/image/ICON/${c.type}.png`" class="img-icon" :alt="c.type"></div>
        <div class="ic"><img :src="c.imageUrl || `/image/CHARA/${c.name}.png`" class="img-icon" :alt="c.name"></div>
      </div>
      <div class="pick-bottom">
        <div class="nm-row">
          <span class="nm">{{ c.name }}</span>
          <span class="nm-wk">{{ t('charSelect.weaknessPrefix') }}<img :src="`/image/ICON/${c.weakness}.png`" class="img-icon nm-wk-icon" :alt="c.weakness">)</span>
        </div>
      </div>
    </div>
  </div>
</template>
