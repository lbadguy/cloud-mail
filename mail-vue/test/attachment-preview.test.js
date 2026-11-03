import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {zipSync, strToU8} from 'fflate'
import {validateOfficeArchive} from '../src/utils/preview-archive.js'

const dom = new JSDOM('<!doctype html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
const {documentFrame, previewKind, decodeText, isRasterImage, readPreviewResponse, MAX_PREVIEW_BYTES} = await import('../src/utils/attachment-preview.js')

test('only supported passive formats have preview actions', () => {
    for (const name of ['a.PDF','a.docx','a.xlsx','a.png','a.md','a.csv']) assert.ok(previewKind(name))
    for (const name of ['a.svg','a.html','a.exe','a.xlsm','a.doc','a.pptx']) assert.equal(previewKind(name), '')
    assert.equal(isRasterImage(strToU8('<svg onload="alert(1)"></svg>').buffer), false)
    assert.equal(isRasterImage(new Uint8Array([137,80,78,71,13,10,26,10]).buffer), true)
})

test('document frame strips active content, links, CSS URLs and remote images', () => {
    const html = documentFrame(`<p>你好</p><a href="https://tracker.invalid">Click</a><script>alert(1)</script><img src="https://tracker.invalid/pixel"><img src="data:image/svg+xml;base64,PHN2Zy8+"><img src="data:image/png;base64,AA=="><style>@import 'https://tracker.invalid/style';</style><iframe src="https://tracker.invalid"></iframe><form action="https://tracker.invalid"><input></form><p style="background:url(https://tracker.invalid/bg)" onclick="alert(1)">text</p>`)
    const frame = new JSDOM(html).window.document
    assert.match(frame.body.textContent, /你好Click/)
    assert.equal(frame.querySelectorAll('script,a,iframe,form,input,svg').length, 0)
    assert.equal(frame.querySelectorAll('img').length, 1)
    assert.equal(frame.querySelector('img').src, 'data:image/png;base64,AA==')
    assert.ok(!html.includes('tracker.invalid'))
    assert.match(frame.querySelector('[http-equiv]').content, /default-src 'none'/)
})

test('text decoding handles UTF-8, UTF-16 and Chinese encodings without rendering markup', () => {
    assert.equal(decodeText(strToU8('中文 <script>').buffer), '中文 <script>')
    assert.equal(decodeText(new Uint8Array([0xff,0xfe,0x2d,0x4e]).buffer), '中')
    assert.equal(decodeText(new Uint8Array([0xd6,0xd0,0xce,0xc4]).buffer), '中文')
})

test('response reader rejects API errors and oversized or cancelled streams', async () => {
    await assert.rejects(readPreviewResponse(new Response('{"code":401}', {headers:{'content-type':'application/json'}})), /previewLoadError/)
    const bytes = new Response(new Uint8Array([1,2,3]), {headers:{'content-type':'application/octet-stream'}})
    assert.deepEqual([...new Uint8Array(await readPreviewResponse(bytes))], [1,2,3])
    const oversized = new Response(new Uint8Array(MAX_PREVIEW_BYTES + 1), {headers:{'content-type':'application/octet-stream'}})
    await assert.rejects(readPreviewResponse(oversized), /previewTooLarge/)
    const controller = new AbortController(); controller.abort()
    await assert.rejects(readPreviewResponse(new Response('a', {headers:{'content-type':'application/octet-stream'}}), controller.signal), /abort/i)
})

test('Office archive expansion is checked before parsing a zip bomb', () => {
    assert.doesNotThrow(() => validateOfficeArchive(zipSync({'word/document.xml':strToU8('<p>text</p>')})))
    const zip = zipSync({'huge.xml':new Uint8Array(21 * 1024 * 1024)})
    assert.throws(() => validateOfficeArchive(zip), /previewTooComplex/)
    const forged = zip.slice()
    const view = new DataView(forged.buffer)
    for (let index=0;index+28<forged.length;index++) {
        const signature=view.getUint32(index,true)
        if(signature===0x04034b50) view.setUint32(index+22,1,true)
        if(signature===0x02014b50) view.setUint32(index+24,1,true)
    }
    assert.throws(() => validateOfficeArchive(forged), /previewTooComplex/)
})
