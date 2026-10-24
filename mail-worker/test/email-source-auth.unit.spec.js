import {beforeEach, describe, expect, it, vi} from 'vitest'
import dayjs from 'dayjs'

const auth = vi.hoisted(() => ({valid: true, permissions: [], user: {userId: 7, email: 'owner@example.com'}}))
vi.mock('../src/utils/jwt-utils', () => ({default: {verifyToken: vi.fn(async () => auth.valid ? {userId: auth.user.userId, token: 'session'} : null)}}))
vi.mock('../src/service/perm-service', () => ({default: {userPermKeys: vi.fn(async () => auth.permissions)}}))
vi.mock('../src/service/user-service', () => ({default: {updateUserInfo: vi.fn()}}))

// Import the actual middleware before the actual route registrations.
import app from '../src/hono/hono'
import '../src/security/security'
import '../src/api/email-api'
import '../src/api/all-email-api'

function environment() {
    const bind = vi.fn((...args) => ({first: async () => args.length === 1 || args[1] === 7 ? {sourceHeaders: null} : null}))
    return {admin: 'admin@example.com', db: {prepare: vi.fn(() => ({bind}))}, kv: {
        get: vi.fn(async () => ({user: auth.user, tokens: ['session'], refreshTime: dayjs().toISOString()})),
    }}
}

beforeEach(() => {
    auth.valid = true
    auth.permissions = []
    auth.user = {userId: 7, email: 'owner@example.com'}
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('source route authentication and authorization', () => {
    it('rejects unauthenticated access before any source query', async () => {
        auth.valid = false
        const env = environment()
        for (const path of ['/email/source', '/allEmail/source']) {
            const response = await app.request(`${path}?emailId=42`, {}, env)
            expect((await response.json()).code).toBe(401)
        }
        expect(env.db.prepare).not.toHaveBeenCalled()
    })
    it('rejects an ordinary user on the all-mail route before querying', async () => {
        const env = environment()
        const response = await app.request('/allEmail/source?emailId=42', {}, env)
        expect((await response.json()).code).toBe(403)
        expect(env.db.prepare).not.toHaveBeenCalled()
    })
    it('scopes personal queries to the current user and prevents caching', async () => {
        const env = environment()
        const response = await app.request('/email/source?emailId=42', {}, env)
        expect((await response.json()).code).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(env.db.prepare.mock.calls[0][0]).toContain('AND user_id = ?')
        expect(env.db.prepare.mock.results[0].value.bind).toHaveBeenCalledWith(42, 7)
        auth.user = {userId: 8, email: 'other@example.com'}
        const other = await app.request('/email/source?emailId=42', {}, env)
        expect((await other.json()).code).toBe(404)
    })
    it.each(['permission', 'admin'])('allows the existing all-email reader (%s)', async kind => {
        if (kind === 'permission') auth.permissions = ['all-email:query']
        else auth.user = {userId: 1, email: 'admin@example.com'}
        const env = environment()
        const response = await app.request('/allEmail/source?emailId=42', {}, env)
        expect((await response.json()).code).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(env.db.prepare.mock.results[0].value.bind).toHaveBeenCalledWith(42)
    })
})
