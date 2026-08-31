const TOURNAMENTS_STORAGE_KEY = "plakoro_tournaments_v1"

export function loadTournaments() {
  try {
    const raw = localStorage.getItem(TOURNAMENTS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function persist(tournaments) {
  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(tournaments))
  } catch (e) {}
}

export function saveTournament(tournament) {
  const all = loadTournaments()
  const idx = all.findIndex(t => t.id === tournament.id)
  if (idx >= 0) all[idx] = tournament
  else all.push(tournament)
  persist(all)
}

export function deleteTournament(id) {
  persist(loadTournaments().filter(t => t.id !== id))
}
