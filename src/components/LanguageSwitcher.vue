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
  top: 0.375rem;
  right: 0.375rem;
  z-index: 300;
  display: flex;
  gap: 0.1875rem;
  background: rgba(0,0,0,.35);
  border-radius: 0.625rem;
  padding: 0.1875rem;
}
.lang-switcher-btn {
  border: none;
  border-radius: 0.4375rem;
  padding: 0.1875rem 0.4375rem;
  font-size: 0.6875rem;
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
