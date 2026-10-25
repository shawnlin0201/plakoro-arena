// The one fetch wrapper every API module goes through.
//
// authApi.js and adminApi.js each had their own copy of this, identical down to the comment
// saying so. That was harmless while it only parsed JSON — it stopped being harmless the
// moment there was a rule about 401, because a rule written in one copy is a rule the other
// half of the app does not follow.
import { getToken, rejectSession } from './session'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

// Whether this request spoke for a signed-in player, which is what makes a 401 about the
// session rather than about the credentials being offered.
function isAuthenticated(headers) {
  return Object.keys(headers || {}).some(k => k.toLowerCase() === 'authorization')
}

/**
 * Resolves with the parsed JSON body, or throws an Error whose message is the server's own
 * `error` string — the UI needs something to show, not a status code to branch on.
 *
 * The exception is 401 on a request that carried a token: that is the server saying the
 * session itself is no longer good, which no amount of retrying will fix, so the session is
 * ended here rather than left for each caller to notice.
 */
export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // Only when we actually sent a token. A failed sign-in is a 401 too (server/index.mjs
    // answers a wrong PIN with one), and signing somebody out because they mistyped a PIN —
    // possibly while already signed in as someone else — would be its own bug.
    if (res.status === 401 && isAuthenticated(headers) && getToken()) rejectSession()
    throw new Error(data?.error || `request failed (${res.status})`)
  }
  return data
}
