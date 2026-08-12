import { ref, computed } from 'vue'
import { preloadEssentialImages, preloadCharacterImages } from '../data/imagePreload'
import { i18n } from '../i18n'
import { asset } from '../data/assetPath'
import charaRaw from '../data/generated/chara.json'
import wazaRaw from '../data/generated/waza.json'
import translationsEn from '../data/translations/en.json'
import translationsZhTW from '../data/translations/zh-TW.json'

const TRANSLATIONS = { en: translationsEn, 'zh-TW': translationsZhTW }

function buildCharaEffect(die, effectStr, type, val) {
  if (!die || String(die) === "0") return null
  const orientations = String(die).replace(/"/g, '').split(',').map(s => s.trim())
  return {
    orientations,
    text: effectStr || "",
    type: type || "",
    value: parseInt(val, 10) || 0
  }
}

const MOVES_BASE = {}
wazaRaw.forEach(w => {
  const chara = []
  const c1 = buildCharaEffect(w.chara_die1, w.chara_effect1, w.chara_effect_type1, w.chara_effect_value1)
  if (c1) chara.push(c1)
  const c2 = buildCharaEffect(w.chara_die2, w.chara_effect2, w.chara_effect_type2, w.chara_effect_value2)
  if (c2) chara.push(c2)
  const c3 = buildCharaEffect(w.chara_die3, w.chara_effect3, w.chara_effect_type3, w.chara_effect_value3)
  if (c3) chara.push(c3)
  let cost = []
  if (w.waza_energy && String(w.waza_energy) !== "0") {
    cost = String(w.waza_energy).replace(/"/g, '').split(',').map(s => s.trim()).filter(s => s !== "")
  }
  MOVES_BASE[w.id] = {
    id: w.id,
    chara_name: w.chara_name,
    name: w.waza_name,
    type: w.waza_type,
    cost,
    baseDamage: parseInt(w.waza_damage, 10) || 0,
    effect: w.waza_effect || "",
    effectType: w.waza_effect_type || "",
    effectValue: parseInt(w.waza_effect_value, 10) || 0,
    chara
  }
})

const CHARACTERS_BASE = charaRaw.map(c => {
  const charaMoves = Object.values(MOVES_BASE)
    .filter(m => m.chara_name === c.name)
    .map(m => m.id)
    .sort((a, b) => {
      const na = Number(a), nb = Number(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return String(a).localeCompare(String(b))
    })
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    weakness: c.weakness_type1 || c.weakness || "",
    weaknessDamage: parseInt(c.weakness_damage, 10) || 20,
    hp: parseInt(c.HP, 10) || 100,
    imageUrl: asset(`image/CHARA/${c.name}.jpg`),
    moves: charaMoves
  }
})

function localizedMoves(locale) {
  const overlay = TRANSLATIONS[locale] && TRANSLATIONS[locale].waza
  if (!overlay) return MOVES_BASE
  const out = {}
  for (const id in MOVES_BASE) {
    const base = MOVES_BASE[id]
    const tr = overlay[id]
    if (!tr) {
      out[id] = base
      continue
    }
    out[id] = {
      ...base,
      name: tr.name || base.name,
      effect: tr.effect !== undefined ? tr.effect : base.effect,
      chara: base.chara.map((ce, i) => {
        const key = `chara_effect${i + 1}`
        return tr[key] !== undefined ? { ...ce, text: tr[key] } : ce
      })
    }
  }
  return out
}

function localizedCharacters(locale) {
  const overlay = TRANSLATIONS[locale] && TRANSLATIONS[locale].chara
  if (!overlay) return CHARACTERS_BASE
  return CHARACTERS_BASE.map(c => {
    const tr = overlay[c.id]
    return tr && tr.name ? { ...c, name: tr.name } : c
  })
}

const locale = i18n.global.locale
const characters = computed(() => localizedCharacters(locale.value))
const moves = computed(() => localizedMoves(locale.value))
const isLoading = ref(true)
const loadError = ref(null)
let imagesPreloaded = false

export function useCharacterData() {
  async function initCharacterData() {
    if (imagesPreloaded) {
      isLoading.value = false
      return
    }
    isLoading.value = true
    loadError.value = null
    await Promise.all([preloadEssentialImages(), preloadCharacterImages(CHARACTERS_BASE)])
    imagesPreloaded = true
    isLoading.value = false
  }

  return { characters, moves, isLoading, loadError, loadData: initCharacterData }
}
