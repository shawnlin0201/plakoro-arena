<script setup>
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES } from '../i18n'

const { locale } = useI18n()
const LABELS = { ja: '日', en: 'EN', 'zh-TW': '繁' }
</script>

<template>
  <div class="lang-switcher">
    <button
      v-for="loc in SUPPORTED_LOCALES"
      :key="loc"
      class="lang-switcher-btn"
      :class="{ active: locale === loc }"
      @click="setLocale(loc)"
    >{{ LABELS[loc] }}</button>
  </div>
</template>

<style scoped>
.lang-switcher {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 300;
  display: flex;
  gap: 3px;
  background: rgba(0,0,0,.35);
  border-radius: 10px;
  padding: 3px;
}
.lang-switcher-btn {
  border: none;
  border-radius: 7px;
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  background: transparent;
  cursor: pointer;
}
.lang-switcher-btn.active {
  background: #AEFF3E;
  color: #2A2A2A;
}
</style>
