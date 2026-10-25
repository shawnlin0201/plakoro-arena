// The session token, kept separate from currentPlayer.js — that module's shape is deliberately
// a nameplate's identity fields (code/name/avatar/background), read by badges and banners that
// have no business touching a credential. A token lives here instead.
const TOKEN_KEY = 'plakoro_session_token_v1'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch (e) {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (e) {
    // Same stance as currentPlayer.js: a full or disabled store just means the session won't
    // survive a reload, not something worth failing sign-in over.
  }
}

// Subscribers to "the server refused this token".
//
// session.js is the one module in this chain that imports nothing, so the notification starts
// here: apiRequest.js can report a dead session without reaching for currentPlayer.js, which
// reaches back here through gifts.js and points.js. A plain callback list rather than an event
// emitter — there is one subscriber and it registers at boot.
const rejectedHandlers = []

export function onSessionRejected(fn) {
  rejectedHandlers.push(fn)
}

/**
 * The token was rejected. Tokens carry no expiry (see server/auth.mjs: the signature over
 * AUTH_SECRET is the only thing that can stop being valid), so in practice this means the
 * secret was rotated and every token issued before it died at once.
 *
 * That happened for real, and nothing noticed: the dead token stayed in localStorage, every
 * authed call kept returning 401, and the app rendered as though every player's data had been
 * deleted. It had not — the data was all still there. What was missing was any path from
 * "rejected" back to a screen the player could act on.
 */
export function rejectSession() {
  setToken(null)
  rejectedHandlers.forEach(fn => {
    try {
      fn()
    } catch (e) {
      // One bad subscriber must not stop the others from tearing their state down.
    }
  })
}
