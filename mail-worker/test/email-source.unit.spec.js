import {describe, it, expect, vi} from 'vitest'
import {captureSourceHeaders, describeSource, normalizePublicIp} from '../src/lib/email-source'
import emailService from '../src/service/email-service'
import {emailListColumns, emailBriefColumns} from '../src/lib/email-list-columns'
import PostalMime from 'postal-mime'

describe('Mail source capture', () => {
    it('captures real parsed MIME headers in original hop order', async () => {
        const parsed = await new PostalMime().parse('Received: from relay ([8.8.8.8]) by cloud.example; Sat\r\nReceived: from client ([1.1.1.1])\r\n\tby relay; Sat\r\nAuthentication-Results: cloud.example; spf=pass\r\nFrom: Sender <sender@example.com>\r\nTo: inbox@example.com\r\nSubject: Test\r\n\r\nOffline fixture')
        const result = describeSource(captureSourceHeaders(parsed))
        expect(result.candidates.map(c => c.ip)).toEqual(['8.8.8.8', '1.1.1.1'])
        expect(result.headers.find(h => h.name === 'authentication-results').value).toContain('spf=pass')
        expect(result.headers.some(h => h.name === 'subject')).toBe(false)
    })
    it('preserves routing and authentication as claims, not verified identity', () => {
        const headers = [
            {key: 'received', value: 'from mx.example ([8.8.8.8]) by inbound.example; Sat'},
            {key: 'received', value: 'from local ([10.0.0.1]) by mx.example'},
            {key: 'authentication-results', value: 'attacker.example; spf=pass; dkim=pass'},
            {key: 'x-unrelated-secret', value: 'do not capture'},
        ]
        const result = describeSource(captureSourceHeaders({headers}))
        expect(result.candidates).toEqual([{ip: '8.8.8.8', header: 'received', hop: 1}])
        expect(result.headers).toHaveLength(3)
        expect(result).not.toHaveProperty('verified')
    })
    it('handles IPv6 and repeated addresses without inventing a sender IP', () => {
        const result = describeSource(captureSourceHeaders({headers: [
            {key: 'received', value: 'from mx ([IPv6:2606:4700:4700::1111]) [8.8.8.8]'},
            {key: 'x-originating-ip', value: '[8.8.8.8]'},
        ]}))
        expect(result.candidates.map(c => c.ip)).toEqual(['2606:4700:4700::1111', '8.8.8.8'])
    })
    it.each(['127.0.0.1', '192.168.0.1', '172.16.1.1', '10.0.0.1', '100.64.0.1', '999.1.1.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '::1', 'fc00::1', 'fe80::1', '2001:db8::1'])('does not call local/invalid IP %s a public source', ip => {
        expect(normalizePublicIp(ip)).toBeNull()
    })
    it('bounds stored headers and tolerates missing historical data', () => {
        const encoded = captureSourceHeaders({headers: Array.from({length: 500}, () => ({key: 'received', value: 'x'.repeat(10000)}))})
        expect(encoded.length).toBeLessThan(35000)
        expect(describeSource(null).available).toBe(false)
        expect(describeSource('bad JSON').available).toBe(false)
        expect(describeSource('null').available).toBe(false)
        expect(describeSource('{"version":1,"headers":[null]}').headers).toEqual([])
    })
    it('never includes source metadata in brief or full list projections', () => {
        expect(emailListColumns).not.toHaveProperty('sourceHeaders')
        expect(emailBriefColumns).not.toHaveProperty('sourceHeaders')
    })
})

describe('Mail source access', () => {
    function mockContext(row) {
        const state = {}
        return {state, context: {env: {db: {prepare: vi.fn(sql => {
            state.sql = sql
            return {bind: (...binds) => {
                state.binds = binds
                return {first: async () => row}
            }}
        })}}}}
    }
    it('restricts the personal route to the owner', async () => {
        const {context, state} = mockContext({sourceHeaders: null})
        expect(await emailService.source(context, {emailId: 42}, 7)).toMatchObject({available: false})
        expect(state.sql).toContain('AND user_id = ?')
        expect(state.binds).toEqual([42, 7])
    })
    it('uses the separately permission-protected all-mail route', async () => {
        const {context, state} = mockContext({sourceHeaders: null})
        await emailService.source(context, {emailId: 42})
        expect(state.binds).toEqual([42])
    })
    it('does not expose another owner’s message and rejects invalid IDs', async () => {
        const {context} = mockContext(null)
        await expect(emailService.source(context, {emailId: 42}, 8)).rejects.toMatchObject({code: 404})
        context.env.db.prepare.mockClear()
        await expect(emailService.source(context, {emailId: '42 OR 1=1'}, 8)).rejects.toMatchObject({code: 400})
        expect(context.env.db.prepare).not.toHaveBeenCalled()
    })
})
