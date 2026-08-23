<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['back'])
const { t } = useI18n()

const MAP_SRC = 'https://www.google.com/maps/d/u/0/embed?mid=1HujCFVZOFo8aJU04hDMDAWwq7QGdtSw&ehbc=2E312F'
const CALENDAR_SRC = 'https://calendar.google.com/calendar/embed?src=126764829787dd1f06b6e0146c761ce0182a843302c08600f27d648886535353%40group.calendar.google.com&ctz=Asia%2FTaipei'
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWCzZUCVvVbAd4n0peiANcEIjicAa4kXEs-c-veuOU39y0c71ug2pTwGiA8GDQijjMg0WuE9jcLY_k/pub?gid=0&single=true&output=csv'

// Minimal CSV parser (handles quoted cells containing commas, e.g. "販售, 比賽, 遊玩") —
// the published sheet never has newlines inside a cell, so this doesn't need to.
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.length > 0)
  return lines.map(line => {
    const cells = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    return cells
  })
}

const stores = ref([])
const isLoading = ref(true)
const loadError = ref('')
const showStoreList = ref(false)

async function loadStores() {
  isLoading.value = true
  loadError.value = ''
  try {
    const res = await fetch(SHEET_CSV_URL)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const rows = parseCSV(await res.text())
    const [header, ...body] = rows
    stores.value = body
      .filter(row => row.some(cell => cell.trim() !== ''))
      .map(row => {
        const store = {}
        header.forEach((key, i) => { store[key.trim()] = (row[i] || '').trim() })
        return store
      })
  } catch (e) {
    loadError.value = e.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadStores)

// The "類型" column is a comma-joined list of tags per store (e.g. "販售, 比賽, 遊玩") —
// split it out per store, and collect the distinct tags across all stores for the filter row.
function storeTypes(store) {
  return (store['類型'] || '').split(',').map(s => s.trim()).filter(Boolean)
}

const allTypes = computed(() => {
  const set = new Set()
  stores.value.forEach(store => storeTypes(store).forEach(ty => set.add(ty)))
  return [...set]
})

const selectedTypes = ref([])

function toggleType(type) {
  const idx = selectedTypes.value.indexOf(type)
  if (idx >= 0) selectedTypes.value.splice(idx, 1)
  else selectedTypes.value.push(type)
}

// Filtering is AND across the selected tags — "比賽 + 遊玩" means a store must have both,
// not either.
const filteredStores = computed(() => {
  if (selectedTypes.value.length === 0) return stores.value
  return stores.value.filter(store => selectedTypes.value.every(ty => storeTypes(store).includes(ty)))
})
</script>

<template>
  <div v-if="!showStoreList" class="board" style="display:flex; flex-direction:column; min-height:0;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem; flex-shrink:0;">{{ t('storeInfo.title') }}</div>

    <div style="flex:1; min-height:0; display:flex; gap:0.5rem; padding:0 0.5rem;">
      <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:0.375rem;">
        <iframe :src="MAP_SRC" style="width:100%; flex:1; min-height:0; border:0; border-radius:0.75rem;"></iframe>
        <button class="btn secondary" @click="showStoreList = true">{{ t('storeInfo.listButton') }}</button>
      </div>
      <div style="flex:1; min-width:0;">
        <iframe :src="CALENDAR_SRC" style="width:100%; height:100%; border:0; border-radius:0.75rem;"></iframe>
      </div>
    </div>

    <div style="display:flex; justify-content:center; padding:0.5rem 0; flex-shrink:0;">
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>

  <div v-else class="board select-board" style="display:flex; flex-direction:column; min-height:0;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem; flex-shrink:0;">{{ t('storeInfo.listTitle') }}</div>

    <div v-if="isLoading" style="text-align:center; padding:1rem; color:var(--sub); font-size:0.875rem;">{{ t('app.loading') }}</div>
    <div v-else-if="loadError" style="text-align:center; padding:1rem; color:var(--sub); font-size:0.875rem;">{{ loadError }}</div>
    <template v-else>
      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; flex-shrink:0; padding:0 0.625rem 0.625rem;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('storeInfo.filterLabel') }}</span>
        <div
          v-for="ty in allTypes"
          :key="ty"
          @click="toggleType(ty)"
          :style="{
            fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
            padding: '0.1875rem 0.5625rem', borderRadius: '0.75rem',
            background: selectedTypes.includes(ty) ? '#AEFF3E' : '#F6F5F0',
            color: 'var(--ink)'
          }"
        >{{ ty }}</div>
      </div>

      <div style="flex:1; min-height:0; overflow:auto; padding:0 0.625rem;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
          <thead>
            <tr style="text-align:left; border-bottom:2px solid var(--line);">
              <th style="padding:0.375rem 0.5rem; white-space:nowrap;">{{ t('storeInfo.colName') }}</th>
              <th style="padding:0.375rem 0.5rem;">{{ t('storeInfo.colAddress') }}</th>
              <th style="padding:0.375rem 0.5rem; white-space:nowrap;">{{ t('storeInfo.colType') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(store, i) in filteredStores" :key="i" style="border-bottom:1px solid var(--line);">
              <td style="padding:0.375rem 0.5rem; font-weight:800; white-space:nowrap;">{{ store['店家名稱'] }}</td>
              <td style="padding:0.375rem 0.5rem; color:var(--sub);">{{ store['地址'] }}</td>
              <td style="padding:0.375rem 0.5rem; white-space:nowrap;">{{ store['類型'] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div style="display:flex; justify-content:center; padding:0.625rem 0; flex-shrink:0;">
      <button class="btn secondary" @click="showStoreList = false">{{ t('common.back') }}</button>
    </div>
  </div>
</template>
