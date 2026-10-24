# TODO

空的。

`MOD_NULLIFY_TAKEN_IF_ENEMY_CHARADICE_左,右`（七夕青鳥「輕飄飄飛行」）已於 2026-10-23
實作，記錄留在 commit 訊息裡。

當時擱置的理由是「引擎只有在骰到的面剛好符合當下招式的判定面時，才知道角色骰朝向」——
那個判斷建立在「app 要模擬骰子」的假設上，而實際上熱座與單機是玩家擲實體骰、由 app 記錄
（3D 擲骰只有線上對戰在用，見 `DiceOverlay.vue` 的 `needsThrow`）。所以線上模式直接讀
`state.charaDieFace`，實體模式問一次，兩行就夠了。

---

啟動時 `effectCoverage` 會把沒有對應處理的效果類型印在 console。那裡是空的，就代表
這份清單也該是空的。
