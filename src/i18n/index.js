import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

export const SUPPORTED_LOCALES = ['ja', 'en', 'zh-TW']
const LOCALE_STORAGE_KEY = 'plakoro_locale'

function detectDefaultLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved
  } catch (e) {}
  const nav = (navigator.language || 'ja').toLowerCase()
  if (nav.startsWith('zh')) return 'zh-TW'
  if (nav.startsWith('en')) return 'en'
  return 'ja'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectDefaultLocale(),
  fallbackLocale: 'ja',
  messages: { ja, en, 'zh-TW': zhTW }
})

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch (e) {}
}
