// Special-event pool for the solo tower-climb map. Each entry only carries the mechanic
// (which stat it touches and by how much) — the actual flavor text and effect description
// live in the i18n locale files under `solo.events.<id>.text` / `solo.events.<id>.effect`,
// so they're translated consistently with the rest of the app. `text` is interpolated with
// a random roster character's name as `{name}`.

export const EVENT_POOL = [
  { id: "pokemonCenter", effectKind: "heal", amount: 30 },
  { id: "berryBush", effectKind: "heal", amount: 20 },
  { id: "oldMaster", effectKind: "atk", amount: 3 },
  { id: "hotSpring", effectKind: "heal", amount: 40 },
  { id: "ironWill", effectKind: "def", amount: 3 },
  { id: "treasureChest", effectKind: "maxHp", amount: 15 },
  { id: "windyHill", effectKind: "atk", amount: 2 },
  { id: "rainyDay", effectKind: "def", amount: 2 },
  { id: "campfireSong", effectKind: "heal", amount: 25 },
  { id: "secretTraining", effectKind: "maxHp", amount: 10 }
]

export function drawRandomEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}
