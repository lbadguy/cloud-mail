import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeEmailSource} from '../src/utils/email-source-summary.js'

const summarize = (...headers) => summarizeEmailSource({headers})
const auth = value => ({name: 'authentication-results', value})

test('extracts server, distinct IPs and authentication summary', () => {
    const result = summarizeEmailSource({headers: [
        {name: 'Received', value: 'from outbound.example.net (192.0.2.9) by mx.example.org'},
        auth('mx.example.org; dkim=pass header.d=example.net; dmarc=pass header.from=example.net; spf=none smtp.helo=outbound.example.net; spf=pass smtp.mailfrom=test@example.net'),
    ], candidates: [{ip: '192.0.2.9'}, {ip: '192.0.2.9'}]})
    assert.equal(result.server, 'outbound.example.net')
    assert.deepEqual(result.ips, ['192.0.2.9'])
    assert.deepEqual(result.authentication, {spf: 'pass', dkim: 'pass', dmarc: 'pass'})
    assert.deepEqual(result.signingDomains, ['example.net'])
    assert.equal(result.authServer, 'mx.example.org')
})

test('MAIL FROM failure is not hidden by a successful HELO', () => {
    assert.equal(summarize(auth('mx; spf=pass smtp.helo=example.net; spf=fail smtp.mailfrom=test@example.net')).authentication.spf, 'fail')
})

test('does not interpret quoted or commented claims as extra results', () => {
    const result = summarize(auth('mx.example.org; spf=fail (reason (nested); dkim=pass); dmarc=fail reason="fake; dkim=pass"'))
    assert.deepEqual(result.authentication, {spf: 'fail', dkim: 'unknown', dmarc: 'fail'})
})

test('distinct DKIM results remain mixed, rather than claiming all passed', () => {
    const result = summarize(auth('mx; dkim=pass header.d="example.net"; dkim=fail header.d=other.example; dkim=pass header.d=example.net'))
    assert.equal(result.authentication.dkim, 'mixed')
    assert.deepEqual(result.signingDomains, ['example.net', 'other.example'])
})

test('prefers first saved Authentication-Results over ARC or later headers', () => {
    const result = summarize({name:'arc-authentication-results', value:'i=1; mx.arc; spf=pass'}, auth('mx.first; spf=fail'), auth('mx.later; spf=pass'))
    assert.equal(result.authentication.spf, 'fail')
    assert.equal(result.authServer, 'mx.first')
})

test('uses ARC record when Authentication-Results is missing', () => {
    const result = summarize({name:'ARC-Authentication-Results', value:'i=1; mx.example.net; dkim=pass header.d=example.net'})
    assert.equal(result.authServer, 'mx.example.net')
    assert.equal(result.authentication.dkim, 'pass')
})

test('Received-SPF is a fallback, and DKIM signature alone does not mean pass', () => {
    const result = summarize({name:'received-spf', value:'Pass (permitted sender)'}, {name:'dkim-signature', value:'v=1; d=example.net'})
    assert.deepEqual(result.authentication, {spf:'pass', dkim:'unknown', dmarc:'unknown'})
})

test('missing and malformed data stays unknown', () => {
    for (const input of [null, {}, {headers: [null, {value:'x'}, {name:'received',value:null}], candidates:[null, {}]}, {headers:{}, candidates:{}}]) {
        const result = summarizeEmailSource(input)
        assert.deepEqual(result.authentication, {spf:'unknown',dkim:'unknown',dmarc:'unknown'})
        assert.equal(result.server, '')
        assert.deepEqual(result.ips, [])
    }
})

test('unrecognized or embedded result words do not fabricate a pass', () => {
    assert.equal(summarize(auth('mx; x-spf=pass; spf=passed; reason="dkim=pass"')).authentication.spf, 'unknown')
})
