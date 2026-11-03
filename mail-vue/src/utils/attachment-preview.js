import DOMPurify from 'dompurify'

export const MAX_PREVIEW_BYTES = 25 * 1024 * 1024
export const MAX_TEXT_BYTES = 2 * 1024 * 1024
const images = new Set(['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'bmp', 'avif'])
const texts = new Set(['txt', 'csv', 'tsv', 'json', 'md', 'log', 'xml', 'yaml', 'yml'])

export function previewKind(filename = '') {
    const ext = String(filename).split('.').pop().toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (images.has(ext)) return 'image'
    if (texts.has(ext)) return 'text'
    return ['docx', 'xlsx'].includes(ext) ? ext : ''
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]))
}

export function sanitizeDocument(html) {
    const fragment = DOMPurify.sanitize(html, {
        RETURN_DOM_FRAGMENT: true,
        ALLOWED_TAGS: ['p','br','h1','h2','h3','h4','h5','h6','strong','em','b','i','u','s','ul','ol','li','blockquote','pre','code','table','thead','tbody','tfoot','tr','td','th','img','sup','sub','hr'],
        ALLOWED_ATTR: ['src','alt','colspan','rowspan'],
        ALLOW_DATA_ATTR: false,
    })
    for (const image of fragment.querySelectorAll('img')) {
        // Remote and active images (including SVG) never enter the preview.
        if (!/^data:image\/(png|jpeg|gif|webp|bmp|avif);base64,[a-z0-9+/=\s]+$/i.test(image.getAttribute('src') || '')) image.remove()
    }
    const container = document.createElement('div')
    container.append(fragment)
    return container.innerHTML
}

// No scripts, networking, forms, embedded documents, or navigable links.
export function documentFrame(html, dark = false) {
    const content = sanitizeDocument(html)
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>
        :root{color-scheme:${dark ? 'dark' : 'light'}}
        *{box-sizing:border-box}body{margin:0;padding:32px;color:${dark ? '#e5e7eb' : '#303133'};background:${dark ? '#202124' : '#fff'};font:15px/1.7 system-ui,sans-serif;overflow-wrap:anywhere}
        article{max-width:850px;margin:auto}img{max-width:100%;height:auto}table{border-collapse:collapse;width:max-content;min-width:100%;font-size:14px}td,th{border:1px solid ${dark ? '#53565d' : '#dcdfe6'};padding:7px 10px;max-width:600px;white-space:pre-wrap}th{font-weight:600}pre{white-space:pre-wrap;tab-size:4;font:14px/1.65 ui-monospace,monospace}h1,h2,h3{line-height:1.35}blockquote{margin-inline:12px}::selection{background:#b3d8ff;color:#102744}@media(max-width:600px){body{padding:18px}}
        </style></head><body><article>${content}</article></body></html>`
}

export function decodeText(buffer) {
    const bytes = new Uint8Array(buffer)
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes) }
    catch { return new TextDecoder('gb18030').decode(bytes) }
}

export function isRasterImage(buffer) {
    const bytes = new Uint8Array(buffer)
    const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length))
    return (bytes[0] === 0x89 && ascii(1, 3) === 'PNG') ||
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) || ascii(0, 2) === 'BM' ||
        (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') ||
        (ascii(4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 4)))
}

export async function readPreviewResponse(response, signal) {
    if (!response.ok || !response.headers.get('content-type')?.startsWith('application/octet-stream')) throw new Error('previewLoadError')
    if (Number(response.headers.get('content-length')) > MAX_PREVIEW_BYTES) throw new Error('previewTooLarge')
    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    try {
        while (true) {
            signal?.throwIfAborted()
            const {done, value} = await reader.read()
            if (done) break
            total += value.byteLength
            if (total > MAX_PREVIEW_BYTES) throw new Error('previewTooLarge')
            chunks.push(value)
        }
    } finally { await reader.cancel().catch(() => {}) }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes.buffer
}
