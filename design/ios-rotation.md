# iOS 旋轉後點擊錯位

2026-11-12 修掉的一個 bug，連同過程中**三次失敗的嘗試**一起記著 —— 那些失敗才是這份
文件真正的價值：下次再遇到類似症狀，可以先把這幾條路排除掉。

## 症狀

玩家回報：手機轉成橫向之後點不到東西，**過 1~5 秒會自己好**。直握一直正常。

回報者是從**主畫面圖示**開啟的（iOS，Safari 加入主畫面）。

## 真正的原因

整個 App 裝在 `#stage { position: fixed; inset: 0 }` 裡。

`position: fixed` 是釘在**版面視窗（layout viewport）**上的，而橫向時 Safari 會自動收起
工具列 —— 那段過渡期間版面視窗比視覺視窗矮一截，於是整個畫面被往下推，直到 Safari 自己
對齊為止。那就是「1~5 秒後自己好」。

## 怎麼查出來的

前兩次都是猜的，兩次都錯。第三次先做了一個診斷面板（`?vpdebug=1`，查完已移除），把
`window` / `visualViewport` / `documentElement` 三組尺寸、`#stage` 的實際矩形，以及每次
點擊的 `event.target` 與 `document.elementFromPoint(clientX, clientY)` 攤在畫面上。

真機橫向量到的是：

```
vv    750x402 @0,-62     視覺視窗與版面視窗差 62px
stage 0,62 750x402       inset:0 的 #stage 被畫在 y=62
tap   ... OK  ×5         命中判定與版面一致
```

兩件事當場定案：

- **命中判定沒有壞。** 五次點擊的 `elementFromPoint` 與 `target` 完全一致，所以「Safari
  用舊座標」那條假設是錯的。
- **偏差是 62px**，而那正好是橫向時 Safari 工具列的高度。

## 有效的做法

1. **轉向後捲一格再捲回來。** `orientationchange` 之後等 300ms（讓旋轉動畫跑完），
   `window.scrollTo(0, 1)` 再 `window.scrollTo(0, 0)`。見
   `src/composables/useStageLayout.js` 的 `realign()`。

   `html, body` 是 `overflow: hidden`，看起來沒有東西可以捲 —— 但被錯開的正是版面視窗，
   而 `scrollTo` 動的就是它。先到 1 再回 0，是因為捲到同一個位置不會觸發任何重算。

2. **`html, body` 加上 `height: 100dvh`**（`100%` 留著當退路）。

3. **`viewport-fit=cover`**。

這三個是一起上線的，**沒有分開驗證**，所以不確定是哪一個生效、或是組合。三者都是每次
載入就套用，與圖示怎麼建立無關 —— 玩家不需要重新加入主畫面。

## 試過但無效的做法

| 做法 | 為什麼沒用 |
|---|---|
| 把 `#stage` 的 `position` 切成 `absolute` 再切回來，強迫重排 | 命中判定本來就沒壞，重排的是一個沒有問題的東西 |
| 用 rAF 每一幀盯尺寸，一變就重排 | 偏差出現時尺寸早就不再變動了。問題從來不是「量得不夠勤」 |
| 「微幅滾動法」以外的 `body display:none` 重排 | 沒試到就先排除了：它會重載 Google 登入的 iframe、讓 3D 骰子的 canvas 收到一次 0×0、把手冊閱讀器的捲動位置清回頂端 |
| `apple-mobile-web-app-capable` | 加了，但實測是用**舊圖示**驗的 —— 那個 meta 只在「加入主畫面」當下生效，舊圖示不受影響，所以它不可能是解法 |

另外排除掉的：**`100vh` 算錯**。主版面沒有用 `100vh`（`position: fixed; inset: 0` 正是
那個技巧在繞過的東西的正解），而且 standalone 模式根本沒有網址列。

## 連帶修掉的兩件事

**跑馬燈的字在橫向時消失。** 一份字在直向是 384px、帶子 375px，所以兩份就夠；轉成橫向
後帶子變 750px、一份字約 412px，兩份鋪不滿，捲到一半會露出一大片空白。`measureTicker`
原本只聽 `window` 的 `resize`，而 iOS 轉向時 `resize` 來得比尺寸更新早 —— 跟上面是同一類
錯。改用 `ResizeObserver` 盯帶子本身：要重量的時機是「帶子寬度變了」，那是元素自己說
的，不會早也不會漏。

**`viewport-fit=cover` 讓左右兩側跑掉。** 它讓 `env(safe-area-inset-*)` 開始有值（橫握時
瀏海那側五十幾 px），於是：

- 滿版的跑馬燈不再滿版 —— 它的負 margin 只扣掉 `.select-board` 的 padding，扣不掉 `#app`
  新增的那一層。
- 貼邊的絕對定位元素壓在瀏海上 —— **絕對定位不吃 padding**，它對齊的是 padding box 的
  外緣。玩家徽章、右上控制列、音樂播放器、底部標記列、離開鍵都要各自把 `env()` 加進自己
  的偏移。

## 下次再遇到的話

先做診斷，不要先猜。關鍵的一行是比對 `event.target` 與
`document.elementFromPoint(e.clientX, e.clientY)`：

- **兩者相同** → 命中判定與版面一致，問題不在座標，強制重排那類手段不會有用。
- **兩者不同** → 命中判定確實停在舊座標，這時候才輪得到重排。

注意這個比對**驗不出**視覺視窗與版面視窗整體錯開的情況（兩邊用的是同一套換算），所以
要同時看 `visualViewport.offsetTop` 與 `#stage` 的 `getBoundingClientRect().top` ——
`inset: 0` 的元素那個值應該永遠是 0。
