// What a 401 means, and — just as importantly — what it does not mean.
//
// This is the incident that prompted the rule: AUTH_SECRET was rotated, every token issued
// before it became invalid at once, and the app answered by rendering empty screens. Nothing
// was deleted. There was simply no path from "the server refuses this token" to "you are
// signed out", so the dead token sat in localStorage being rejected forever.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { request } from './apiRequest'
import { getToken, setToken, onSessionRejected } from './session'

const store = new Map()
vi.stubGlobal('localStorage', {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
})

function reply(status, body = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })))
}

const AUTHED = { headers: { Authorization: 'Bearer dead.token' } }

describe('request', () => {
  beforeEach(() => {
    store.clear()
    setToken('dead.token')
  })

  it('returns the body when the call succeeds', async () => {
    reply(200, { code: 'P000003' })
    expect(await request('/api/players/me', AUTHED)).toEqual({ code: 'P000003' })
    expect(getToken()).toBe('dead.token')
  })

  it('throws the server’s own error string', async () => {
    reply(400, { error: 'pin too short' })
    await expect(request('/api/auth/register', { method: 'POST' })).rejects.toThrow('pin too short')
  })

  describe('401', () => {
    it('ends the session when the request carried a token', async () => {
      reply(401, { error: 'unauthorized' })
      await expect(request('/api/players/me', AUTHED)).rejects.toThrow('unauthorized')
      expect(getToken()).toBeNull()
    })

    it('tells subscribers, so the app can tear down more than the token', async () => {
      const signedOut = vi.fn()
      onSessionRejected(signedOut)
      reply(401, { error: 'unauthorized' })
      await expect(request('/api/players/me', AUTHED)).rejects.toThrow()
      expect(signedOut).toHaveBeenCalled()
    })

    // The case that makes the Authorization check load-bearing rather than decorative: a wrong
    // PIN is answered with 401 too (server/index.mjs). Signing somebody out because they
    // mistyped a PIN — possibly while already signed in as someone else — is its own bug.
    it('leaves the session alone when the call was a failed sign-in', async () => {
      reply(401, { error: 'wrong account or pin' })
      await expect(request('/api/auth/login', { method: 'POST' })).rejects.toThrow('wrong account or pin')
      expect(getToken()).toBe('dead.token')
    })

    it('does not fire when there was no session to lose', async () => {
      setToken(null)
      const signedOut = vi.fn()
      onSessionRejected(signedOut)
      reply(401, { error: 'unauthorized' })
      await expect(request('/api/players/me', AUTHED)).rejects.toThrow()
      expect(signedOut).not.toHaveBeenCalled()
    })
  })
})
