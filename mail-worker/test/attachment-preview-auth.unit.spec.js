import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {DatabaseSync} from 'node:sqlite'
import dayjs from 'dayjs'

const auth = vi.hoisted(() => ({valid:true, permissions:[], user:{userId:7,email:'owner@example.com'}}))
vi.mock('../src/utils/jwt-utils', () => ({default:{verifyToken:vi.fn(async () => auth.valid ? {userId:auth.user.userId,token:'session'} : null)}}))
vi.mock('../src/service/perm-service', () => ({default:{userPermKeys:vi.fn(async () => auth.permissions)}}))
vi.mock('../src/service/user-service', () => ({default:{updateUserInfo:vi.fn()}}))
vi.mock('../src/service/r2-service', () => ({default:{toObjResp:vi.fn(async () => new Response('saved-attachment'))}}))
import r2Service from '../src/service/r2-service'
import app from '../src/hono/hono'
import '../src/security/security'
import '../src/api/email-api'
import '../src/api/all-email-api'

let database
function environment() {
    database = new DatabaseSync(':memory:')
    database.exec(`CREATE TABLE email(email_id INTEGER PRIMARY KEY,user_id INTEGER);
        CREATE TABLE attachments(att_id INTEGER PRIMARY KEY,email_id INTEGER,user_id INTEGER,key TEXT,size INTEGER,type INTEGER,content_id TEXT);
        INSERT INTO email VALUES(42,7),(43,8);
        INSERT INTO attachments VALUES(1,42,7,'attachments/hash.pdf',100,0,NULL),(2,43,8,'attachments/other.pdf',100,0,NULL),
            (3,42,7,'https://tracker.invalid/file.pdf',100,0,NULL),(4,42,7,'attachments/large.pdf',30000000,0,NULL),
            (5,42,8,'attachments/wrong-owner.pdf',100,0,NULL);`)
    return {admin:'admin@example.com',db:{prepare:vi.fn(sql => ({bind:(...args) => ({first:async () => database.prepare(sql).get(...args)})}))},kv:{get:vi.fn(async () => ({user:auth.user,tokens:['session'],refreshTime:dayjs().toISOString()}))}}
}
beforeEach(() => { auth.valid=true; auth.permissions=[]; auth.user={userId:7,email:'owner@example.com'}; vi.clearAllMocks(); vi.spyOn(console,'log').mockImplementation(() => {}) })
afterEach(() => {database?.close();database=undefined})

describe('authenticated attachment preview with real ownership SQL', () => {
    it('rejects unauthenticated and unprivileged all-mail access before storage', async () => {
        const env = environment()
        auth.valid=false
        expect((await (await app.request('/email/attachmentPreview?emailId=42&attId=1',{},env)).json()).code).toBe(401)
        auth.valid=true
        expect((await (await app.request('/allEmail/attachmentPreview?emailId=43&attId=2',{},env)).json()).code).toBe(403)
        expect(env.db.prepare).not.toHaveBeenCalled()
        expect(r2Service.toObjResp).not.toHaveBeenCalled()
    })
    it('returns only owned saved bytes and safe non-cacheable headers', async () => {
        const response = await app.request('/email/attachmentPreview?emailId=42&attId=1',{},environment())
        expect(await response.text()).toBe('saved-attachment')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('content-type')).toBe('application/octet-stream')
        expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
        expect(r2Service.toObjResp.mock.calls[0][1]).toBe('attachments/hash.pdf')
    })
    it('rejects cross-user, wrong-mail, mismatched-owner, arbitrary URL and oversized attachments', async () => {
        const env = environment()
        for (const query of ['emailId=43&attId=2','emailId=43&attId=1','emailId=42&attId=5','emailId=42&attId=3','emailId=bad&attId=1']) {
            expect((await app.request(`/email/attachmentPreview?${query}`,{},env)).status).toBe(404)
        }
        expect((await app.request('/email/attachmentPreview?emailId=42&attId=4',{},env)).status).toBe(413)
        expect(r2Service.toObjResp).not.toHaveBeenCalled()
    })
    it.each(['permission','admin'])('uses the existing all-mail read authorization (%s)', async kind => {
        if(kind === 'permission') auth.permissions=['all-email:query']
        else auth.user={userId:1,email:'admin@example.com'}
        const response=await app.request('/allEmail/attachmentPreview?emailId=43&attId=2',{},environment())
        expect(await response.text()).toBe('saved-attachment')
    })
    it('handles missing storage objects and enforces the actual streamed byte limit', async () => {
        const env=environment()
        r2Service.toObjResp.mockResolvedValueOnce(null)
        expect((await app.request('/email/attachmentPreview?emailId=42&attId=1',{},env)).status).toBe(404)
        r2Service.toObjResp.mockResolvedValueOnce(new Response(new Uint8Array(25*1024*1024+1)))
        const response=await app.request('/email/attachmentPreview?emailId=42&attId=1',{},env)
        await expect(response.arrayBuffer()).rejects.toThrow('Preview size limit exceeded')
    })
})
