import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {DatabaseSync} from 'node:sqlite'
import dayjs from 'dayjs'

const auth = vi.hoisted(() => ({valid: true, permissions: [], user: {userId: 7, email: 'owner@example.com'}}))
vi.mock('../src/utils/jwt-utils', () => ({default: {verifyToken: vi.fn(async () => auth.valid ? {userId: auth.user.userId, token: 'session'} : null)}}))
vi.mock('../src/service/perm-service', () => ({default: {userPermKeys: vi.fn(async () => auth.permissions)}}))
vi.mock('../src/service/user-service', () => ({default: {updateUserInfo: vi.fn()}}))

import app from '../src/hono/hono'
import '../src/security/security'
import '../src/api/email-api'
import '../src/api/all-email-api'

let database
function environment() {
    database = new DatabaseSync(':memory:')
    database.exec(`
        CREATE TABLE email (email_id INTEGER PRIMARY KEY, user_id INTEGER);
        CREATE TABLE email_tracking_event (event_id TEXT, email_id INTEGER, event_type TEXT, occurred_at TEXT);
        INSERT INTO email VALUES (42, 7), (43, 8);
        INSERT INTO email_tracking_event VALUES
            ('open_1', 42, 'email.opened', '2026-10-27T10:00:00Z'),
            ('click_1', 42, 'email.clicked', '2026-10-27T10:01:00Z'),
            ('click_2', 42, 'email.clicked', '2026-10-27T10:02:00Z'),
            ('other_click', 43, 'email.clicked', '2026-10-27T10:03:00Z');
    `)
    return {admin: 'admin@example.com', db: {prepare: vi.fn(sql => ({
        bind: (...args) => ({all: async () => ({results: database.prepare(sql).all(...args)})}),
    }))}, kv: {
        get: vi.fn(async () => ({user: auth.user, tokens: ['session'], refreshTime: dayjs().toISOString()})),
    }}
}

beforeEach(() => {
    auth.valid = true
    auth.permissions = []
    auth.user = {userId: 7, email: 'owner@example.com'}
    vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { database?.close(); database = undefined })

describe('engagement history routes with real SQLite queries', () => {
    it('requires login for open and click history on both routes', async () => {
        auth.valid = false
        const env = environment()
        for (const prefix of ['email', 'allEmail']) for (const kind of ['openEvents', 'clickEvents']) {
            const response = await app.request(`/${prefix}/${kind}?emailId=42`, {}, env)
            expect((await response.json()).code).toBe(401)
        }
        expect(env.db.prepare).not.toHaveBeenCalled()
    })
    it('rejects all-mail history without the existing read permission', async () => {
        const env = environment()
        for (const kind of ['openEvents', 'clickEvents']) {
            const response = await app.request(`/allEmail/${kind}?emailId=42`, {}, env)
            expect((await response.json()).code).toBe(403)
        }
        expect(env.db.prepare).not.toHaveBeenCalled()
    })
    it('separates event types, sorts newest first, and prevents cross-user access and caching', async () => {
        const env = environment()
        const clicks = await app.request('/email/clickEvents?emailId=42', {}, env)
        expect(clicks.headers.get('cache-control')).toBe('no-store')
        expect((await clicks.json()).data.map(event => event.eventId)).toEqual(['click_2', 'click_1'])
        const opens = await app.request('/email/openEvents?emailId=42', {}, env)
        expect((await opens.json()).data.map(event => event.eventId)).toEqual(['open_1'])
        const other = await app.request('/email/clickEvents?emailId=43', {}, env)
        expect((await other.json()).data).toEqual([])
    })
    it.each(['permission', 'admin'])('allows existing all-mail readers (%s)', async kind => {
        if (kind === 'permission') auth.permissions = ['all-email:query']
        else auth.user = {userId: 1, email: 'admin@example.com'}
        const env = environment()
        const response = await app.request('/allEmail/clickEvents?emailId=43', {}, env)
        const body = await response.json()
        expect(body.code).toBe(200)
        expect(body.data.map(event => event.eventId)).toEqual(['other_click'])
        expect(response.headers.get('cache-control')).toBe('no-store')
    })
})
