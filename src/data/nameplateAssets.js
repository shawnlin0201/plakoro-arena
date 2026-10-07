// Every piece of nameplate artwork, keyed by id.
//
// Read off the folders rather than listed by hand: a new season is four files for the flag and
// four for the avatar, and a list that has to be edited alongside them is a list that will one
// day be edited wrong. Dropping a file in is the whole of adding an asset.
//
// The id is the filename without its extension — `2026-10-champion`, `perfect-mascot`. That is
// what gets stored on a nameplate, so it has to stay stable: renaming a file renames the id and
// orphans every nameplate pointing at it.
//
// Shared by the screen and the PNG export, so the two cannot disagree about what exists.

function registry(modules) {
  return Object.fromEntries(
    Object.entries(modules).map(([path, url]) => [
      path.split('/').pop().replace(/\.\w+$/, ''),
      url
    ])
  )
}

// The options have to be written out at each call: Vite reads these statically at build time,
// so a shared variable is not something it can follow.
export const BACKGROUND_URLS = registry(
  import.meta.glob('../assets/banner-bg/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }))

export const AVATAR_URLS = registry(
  import.meta.glob('../assets/avatar/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }))

// Optional overlay. Most tiers have none, and that is the normal case rather than a gap.
export const AVATAR_BORDER_URLS = registry(
  import.meta.glob('../assets/avatar-border/*.{png,webp}', { eager: true, query: '?url', import: 'default' }))

export const BACKGROUND_IDS = Object.keys(BACKGROUND_URLS)
export const AVATAR_IDS = Object.keys(AVATAR_URLS)

// What a nameplate falls back to when its stored id names artwork that no longer exists —
// a season's files removed, a filename changed. Picking the oldest `default` keeps the
// fallback stable as new seasons arrive.
export const FALLBACK_BACKGROUND = BACKGROUND_IDS.find(id => id.endsWith('-default')) || BACKGROUND_IDS[0]
export const FALLBACK_AVATAR = AVATAR_IDS.find(id => id.endsWith('-default')) || AVATAR_IDS[0]

export function backgroundUrl(id) {
  return BACKGROUND_URLS[id] || BACKGROUND_URLS[FALLBACK_BACKGROUND]
}

export function avatarUrl(id) {
  return AVATAR_URLS[id] || AVATAR_URLS[FALLBACK_AVATAR]
}

export function avatarBorderUrl(id) {
  return AVATAR_BORDER_URLS[id] || null
}
