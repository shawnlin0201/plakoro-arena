const MOVE_HISTORY_STORAGE_KEY = "baycal_move_select_history_v1"

export function loadMoveHistory() {
  try {
    const raw = localStorage.getItem(MOVE_HISTORY_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (e) {
    return {}
  }
}

export function saveMoveHistoryForChar(charId, moveIds) {
  try {
    const hist = loadMoveHistory()
    hist[charId] = moveIds
    localStorage.setItem(MOVE_HISTORY_STORAGE_KEY, JSON.stringify(hist))
  } catch (e) {}
}
