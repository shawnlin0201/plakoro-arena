<!-- Admin-only: 開新賽季。
     兩件事在同一頁，因為它們是同一個動作的兩半 —— 把目前賽季指到新的一季（決定新玩家
     註冊時拿到什麼），然後把那一季的東西發給所有現有玩家（決定他們什麼時候知道新賽季
     開始了）。分成兩頁的話，很容易只做了其中一半。
     從工具選單進來，且只在管理模式下看得到（見 ModeSelect.vue 的 adminOnly）。 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as adminApi from '../../data/adminApi'
import { adminToken } from '../../data/adminSession'
import { SEASONS, avatarUrl, backgroundUrl, hasArtwork } from '../../data/nameplateAssets'
import { TITLE_GROUPS, describeAsset } from '../../data/assetCatalogue'

const emit = defineEmits(['back'])
const { t } = useI18n()

/* 賽季依時間排，不是依字串排。
   賽季代號是 `2026-9`、`2026-12` 這種寫法，月份沒有補零，所以字串排序會把 10 月排在
   9 月前面（'1' < '9'）。拆成數字比大小就跟寫法無關 —— 以後補零或不補零都排得對。
   新的排前面：要選的幾乎都是最新那一季。 */
const seasons = computed(() => [...SEASONS].sort((a, b) => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return by - ay || bm - am
}))

const currentSeason = ref('')
const savingSeason = ref(false)
const seasonDraft = ref('')
const error = ref('')
const ok = ref('')

onMounted(async () => {
  try {
    const { currentSeason: s } = await adminApi.getSeason(adminToken.value)
    currentSeason.value = s || ''
    seasonDraft.value = s || seasons.value[0] || ''
    sendSeason.value = seasonDraft.value
  } catch (e) {
    error.value = e.message
  }
})

async function saveSeason() {
  if (savingSeason.value || !seasonDraft.value) return
  savingSeason.value = true
  error.value = ''
  ok.value = ''
  try {
    const { currentSeason: s } = await adminApi.setSeason(adminToken.value, seasonDraft.value)
    currentSeason.value = s
    ok.value = `目前賽季已設為 ${s}`
  } catch (e) {
    error.value = e.message
  } finally {
    savingSeason.value = false
  }
}

/* ── 發送 ────────────────────────────────────────────────────────────────
   要發的那一季，跟「目前賽季」分開選。多數時候是同一季，但補發舊的一季（例如賽季中途
   才註冊的人）是會發生的事，而那時候不該被迫先改目前賽季。 */
const sendSeason = ref('')

// 基本款從賽季代號推得出來，稱號推不出來：賽季代號是 `2026-12`，稱號的分組是 `meetup3`，
// 兩者之間沒有任何資料把它們連起來。與其在這裡用字串猜，不如讓人選 —— 一季只選一次。
const artworkItems = computed(() => {
  const id = `${sendSeason.value}-default`
  return [
    { kind: 'avatar', asset: id, label: '頭像', url: avatarUrl(id) },
    { kind: 'background', asset: id, label: '旗幟', url: backgroundUrl(id) }
  ].filter(i => hasArtwork(i.kind, i.asset))
})

const titleId = ref('')
const titleOptions = computed(() =>
  TITLE_GROUPS.flatMap(g => g.titles.map(ti => ({ ...ti, groupLabel: g.label }))))

const items = computed(() => [
  ...artworkItems.value.map(i => ({ kind: i.kind, asset: i.asset })),
  ...(titleId.value ? [{ kind: 'title', asset: titleId.value }] : [])
])

const nameOf = (kind, asset) => describeAsset(kind, asset)?.name || asset

// 預設訊息，可以改。給預設是因為空白的訊息欄會讓人直接送出，而禮物上就會印出素材目錄裡
// 那句泛用的獲取條件 —— 開季禮物值得一句當下的話。
const note = ref('')
const defaultNote = computed(() => {
  const first = artworkItems.value[0]
  const name = first ? describeAsset(first.kind, first.asset)?.obtain : ''
  return name || `${sendSeason.value} 賽季開跑`
})
const noteToSend = computed(() => note.value.trim() || defaultNote.value)

/* ── 雙重確認 ────────────────────────────────────────────────────────────
   這個按鈕一按就寄到每一個人的信箱，收回來要一筆一筆刪。所以不是「確定嗎？」那種可以
   閉著眼睛按掉的問句，而是把真正會發生的事攤開來：幾個人、哪幾樣、信上寫什麼。 */
const confirming = ref(false)
const sending = ref(false)
const result = ref(null)

async function send() {
  if (sending.value || !items.value.length) return
  sending.value = true
  error.value = ''
  ok.value = ''
  try {
    result.value = await adminApi.broadcastUnlocks(adminToken.value, items.value, noteToSend.value)
    confirming.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="board select-board se-board">
    <div class="modal-title">{{ t('mode.adminSeason') }}</div>

    <div class="se-scroll">
      <p v-if="error" class="se-error">{{ error }}</p>
      <p v-if="ok" class="se-ok">{{ ok }}</p>

      <!-- 目前賽季 -->
      <section class="se-card">
        <h3 class="se-h">目前賽季</h3>
        <p class="se-hint">新玩家註冊時，會收到這一季的賽季頭像與基本旗幟。</p>
        <div class="se-row">
          <select v-model="seasonDraft" class="se-in">
            <option v-for="s in seasons" :key="s" :value="s">{{ s }}</option>
          </select>
          <button
            class="btn se-btn"
            :disabled="savingSeason || !seasonDraft || seasonDraft === currentSeason"
            @click="saveSeason"
          >設為目前賽季</button>
        </div>
        <p class="se-now">現在是 <strong>{{ currentSeason || '（未設定）' }}</strong></p>
      </section>

      <!-- 發送 -->
      <section class="se-card">
        <h3 class="se-h">發送開季禮物</h3>
        <p class="se-hint">
          發給<strong>全部</strong>玩家，每人一份未開封的禮物。已經有的人不會重複收到，
          所以賽季中途要補發給新玩家，再按一次就好。
        </p>

        <div class="se-row">
          <span class="se-lab">賽季</span>
          <select v-model="sendSeason" class="se-in" @change="result = null; confirming = false">
            <option v-for="s in seasons" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="se-row">
          <span class="se-lab">稱號</span>
          <select v-model="titleId" class="se-in" @change="confirming = false">
            <option value="">（不發稱號）</option>
            <optgroup v-for="g in TITLE_GROUPS" :key="g.key" :label="g.label">
              <option v-for="ti in g.titles" :key="ti.id" :value="ti.id">{{ ti.name }}</option>
            </optgroup>
          </select>
        </div>

        <!-- 會送出什麼，在按下去之前就看得到 -->
        <ul class="se-items">
          <li v-for="i in artworkItems" :key="i.kind + i.asset" class="se-item">
            <img :src="i.url" class="se-thumb" :class="{ wide: i.kind === 'background' }" alt="">
            <span class="se-item-kind">{{ i.label }}</span>
            <span class="se-item-name">{{ nameOf(i.kind, i.asset) }}</span>
          </li>
          <li v-if="titleId" class="se-item">
            <span class="se-thumb se-thumb-title">稱</span>
            <span class="se-item-kind">稱號</span>
            <span class="se-item-name">{{ nameOf('title', titleId) }}</span>
          </li>
          <li v-if="!items.length" class="se-item se-none">這一季沒有可發的素材</li>
        </ul>

        <label class="se-f">
          <span class="se-lab">訊息（印在禮物上）</span>
          <textarea
            v-model="note"
            class="se-in se-ta"
            rows="2"
            :placeholder="defaultNote"
            @input="confirming = false"
          ></textarea>
        </label>

        <div class="se-row se-send">
          <button
            v-if="!confirming"
            class="btn se-btn"
            :disabled="!items.length"
            @click="confirming = true; result = null"
          >發送給全體玩家…</button>
        </div>

        <!-- 第二道：把真正會發生的事寫出來再按一次 -->
        <div v-if="confirming" class="se-confirm">
          <p class="se-confirm-h">確定要發送嗎？</p>
          <ul class="se-confirm-list">
            <li v-for="i in items" :key="i.kind + i.asset">{{ nameOf(i.kind, i.asset) }}</li>
          </ul>
          <p class="se-confirm-note">訊息：{{ noteToSend }}</p>
          <p class="se-confirm-warn">會寄給所有玩家，送出後只能一筆一筆收回。</p>
          <div class="se-row">
            <button class="btn secondary se-btn" :disabled="sending" @click="confirming = false">取消</button>
            <button class="btn se-btn" :disabled="sending" @click="send">
              {{ sending ? '發送中…' : '確定發送' }}
            </button>
          </div>
        </div>

        <p v-if="result" class="se-ok">
          已發送：{{ result.players }} 位玩家，新增 {{ result.granted }} 份禮物（差額是本來就有的人）。
        </p>
      </section>
    </div>

    <div class="se-foot">
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>
</template>

<style scoped>
.se-board { display: flex; flex-direction: column; min-height: 0; }
.se-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 0.125rem; }
.se-foot { flex-shrink: 0; display: flex; justify-content: center; padding-top: 0.75rem; }

.se-card {
  background: var(--card);
  border-radius: var(--radius-sm);
  padding: 0.625rem 0.75rem 0.75rem;
  margin-bottom: 0.625rem;
  box-shadow: var(--shadow);
}
.se-h { margin: 0 0 0.25rem; font-size: 0.8125rem; font-weight: 800; color: var(--ink); }
.se-hint { margin: 0 0 0.5rem; font-size: 0.625rem; line-height: 1.5; color: var(--sub); }
.se-now { margin: 0.375rem 0 0; font-size: 0.625rem; color: var(--sub); }

.se-row { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
.se-send { margin-top: 0.5rem; }
.se-lab { font-size: 0.625rem; font-weight: 800; color: var(--sub); }
.se-f { display: flex; flex-direction: column; gap: 0.1875rem; margin-top: 0.5rem; }

.se-in {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink);
  padding: 0.3125rem 0.375rem;
  border: 0.125rem solid var(--line);
  border-radius: var(--radius-sm);
  background: #fff;
}
.se-ta { width: 100%; resize: vertical; font-family: inherit; }
.se-btn { padding: 0.375rem 0.625rem; font-size: 0.6875rem; }

.se-items { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.se-item { display: flex; align-items: center; gap: 0.375rem; font-size: 0.6875rem; }
.se-item-kind { font-weight: 800; color: var(--sub); min-width: 2rem; }
.se-item-name { font-weight: 700; color: var(--ink); }
.se-none { color: var(--sub); }
.se-thumb { width: 1.5rem; height: 1.5rem; border-radius: 0.25rem; object-fit: cover; flex-shrink: 0; }
.se-thumb.wide { width: 4rem; }
.se-thumb-title {
  display: flex; align-items: center; justify-content: center;
  background: #262420; color: #fff; font-size: 0.625rem; font-weight: 800;
}

/* 第二道確認長得跟一般區塊不一樣，是刻意的：顏色一換，就知道自己已經不在「還在調整」
   的狀態，而是在「下一步就寄出去了」的狀態。 */
.se-confirm {
  margin-top: 0.5rem;
  padding: 0.5rem 0.625rem 0.625rem;
  border: 0.125rem solid #C0392B;
  border-radius: var(--radius-sm);
  background: rgba(192, 57, 43, 0.06);
}
.se-confirm-h { margin: 0 0 0.25rem; font-size: 0.75rem; font-weight: 800; color: #C0392B; }
.se-confirm-list { margin: 0 0 0.25rem; padding-left: 1rem; font-size: 0.6875rem; font-weight: 700; color: var(--ink); }
.se-confirm-note { margin: 0 0 0.25rem; font-size: 0.625rem; color: var(--ink); }
.se-confirm-warn { margin: 0 0 0.5rem; font-size: 0.625rem; font-weight: 800; color: #C0392B; }

.se-error { margin: 0 0 0.375rem; font-size: 0.625rem; font-weight: 800; color: #C0392B; }
.se-ok { margin: 0.375rem 0 0; font-size: 0.625rem; font-weight: 800; color: #2E7D32; }
</style>
