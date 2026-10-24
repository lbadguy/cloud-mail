import {test} from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'

const dom = new JSDOM('', {url: 'https://mail.example/'})
globalThis.window = dom.window
globalThis.document = dom.window.document
const {buildEmailDocument, prepareEmailHtml, emailContentPolicy} = await import('../src/utils/email-html.js')

test('privacy is fail-closed by default, including CSS, fonts, frames and forms', () => {
    const policy = emailContentPolicy()
    assert.match(policy, /img-src data:;/)
    assert.match(policy, /font-src 'none'/)
    for (const directive of ['connect-src', 'script-src', 'frame-src', 'media-src', 'form-action', 'base-uri']) {
        assert.ok(policy.includes(`${directive} 'none'`))
    }
})

test('blocks remote and relative images, srcset, media, SVG, ping and navigation primitives', () => {
    const clean = prepareEmailHtml(`<body><p>Hello</p>
      <img src="https://tracker.invalid/open" srcset="https://tracker.invalid/2x 2x">
      <img src="//tracker.invalid/open"><img src="/relative/open">
      <svg><image href="https://tracker.invalid/svg"/></svg>
      <link rel="preload" href="https://tracker.invalid/prefetch">
      <meta http-equiv="refresh" content="0;url=https://tracker.invalid">
      <iframe src="https://tracker.invalid/frame"></iframe><video poster="https://tracker.invalid/poster"></video>
      <a href="https://example.com" ping="https://tracker.invalid/ping">Link</a>
      <form action="https://tracker.invalid"><input name="x"></form>
    </body>`).html
    const body = new JSDOM(clean).window.document.body
    assert.equal(body.querySelectorAll('[src], [srcset], [ping], iframe, svg, form, meta, link, video').length, 0)
    assert.equal(body.querySelector('a').rel, 'noopener noreferrer')
    assert.equal(body.querySelector('a').target, '_blank')
    assert.match(body.textContent, /Hello/)
})

test('policy precedes every byte of untrusted content and cannot be replaced by email meta', () => {
    const html = buildEmailDocument('<meta http-equiv="Content-Security-Policy" content="default-src *"><p style="background:url(https://tracker.invalid)">Body</p>')
    assert.equal((html.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1)
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('tracker.invalid'))
    assert.match(html, /form-action 'none'/)
})

test('keeps mail head CSS and body layout without nesting document roots', () => {
    const clean = prepareEmailHtml('<html><head><style>p{color:red}</style></head><body style="padding:10px"><p>Body</p></body></html>')
    assert.match(clean.html, /<style>p\{color:red\}<\/style>/)
    assert.equal(clean.bodyStyle, 'padding:10px')
    assert.doesNotMatch(clean.html, /<(?:head|body|html)[\s>]/)
    const doc = new JSDOM(buildEmailDocument('<body style="padding:10px"><p>Body</p></body>')).window.document
    assert.equal(doc.body.style.padding, '10px')
})

test('reply/draft editor removes CSS leaks including escaped URLs, not only img', () => {
    const html = prepareEmailHtml(`<style>@import 'https://tracker.invalid';p{background:image-set(url(https://tracker.invalid) 1x)}</style><p style="background:u\\72l(https://tracker.invalid)">Text</p><table background="https://tracker.invalid"><tr><td style="font-family:test">Cell</td></tr></table>`, {forEditor: true}).html
    const doc = new JSDOM(html).window.document
    assert.equal(doc.querySelectorAll('style, [style], [background], [src]').length, 0)
    assert.match(doc.body.textContent, /Text/)
    assert.match(doc.body.textContent, /Cell/)
})

test('embedded raster data images survive but remote data SVG does not', () => {
    const html = prepareEmailHtml('<img src="data:image/png;base64,AAAA"><img src="data:image/svg+xml;base64,AAAA">').html
    const images = new JSDOM(html).window.document.querySelectorAll('img')
    assert.match(images[0].src, /^data:image\/png/)
    assert.equal(images[1].hasAttribute('src'), false)
})

test('turning protection off explicitly allows network images without allowing scripts', () => {
    const html = prepareEmailHtml('<img src="https://example.com/image"><script>alert(1)</script>', {protectReading: false}).html
    assert.match(html, /src="https:\/\/example.com\/image"/)
    assert.doesNotMatch(html, /<script/)
    assert.match(emailContentPolicy(false), /img-src data: https: http:/)
    assert.match(emailContentPolicy(false), /script-src 'none'/)
})

test('account preference defaults on and stays isolated between users', async () => {
    const {privacyAccountKey, isReadingProtected} = await import('../src/utils/privacy-preferences.js')
    const preferences = {}
    const first = privacyAccountKey({userId: 1})
    const second = privacyAccountKey({userId: 2})
    assert.equal(isReadingProtected(preferences, first), true)
    preferences[first] = false
    assert.equal(isReadingProtected(preferences, first), false)
    assert.equal(isReadingProtected(preferences, second), true)
})
