import DOMPurify from 'dompurify'

export function sanitizeEmailHtml(html) {
    if (!html) return html
    return DOMPurify.sanitize(html, {
        WHOLE_DOCUMENT: true,
        ADD_ATTR: ['target'],
    })
}

// This policy is enforced inside an isolated document, not on the application.
export function emailContentPolicy(protectReading = true) {
    return `default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; media-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data:${protectReading ? '' : ' https: http:'}; font-src ${protectReading ? "'none'" : 'data: https: http:'}`
}

export function prepareEmailHtml(html, {protectReading = true, forEditor = false} = {}) {
    const root = DOMPurify.sanitize(html || '', {
        WHOLE_DOCUMENT: true,
        RETURN_DOM: true,
        USE_PROFILES: {html: true},
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['base', 'link', 'meta', 'form', 'input', 'button', 'textarea', 'select', 'template', 'audio', 'video'],
    })
    // RETURN_DOM is inert; nothing is connected before the policy exists.
    for (const element of root.querySelectorAll('*')) {
        for (const name of ['ping', 'srcset', 'background', 'poster', 'action', 'formaction']) element.removeAttribute(name)
        if (element.tagName === 'A') {
            const href = element.getAttribute('href') || ''
            if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href')
            element.setAttribute('target', '_blank')
            element.setAttribute('rel', 'noopener noreferrer')
            element.setAttribute('referrerpolicy', 'no-referrer')
        }
        if (element.hasAttribute('src')) {
            const src = element.getAttribute('src') || ''
            const localRaster = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,/i.test(src)
            if ((protectReading && !localRaster) || element.tagName !== 'IMG') element.removeAttribute('src')
            element.setAttribute('referrerpolicy', 'no-referrer')
        }
        // The editor isn't sandboxed: drop CSS rather than trying to detect
        // every escaped url(), @import, image-set(), or font leak.
        if (forEditor && protectReading) element.removeAttribute('style')
    }
    if (forEditor && protectReading) {
        for (const style of root.querySelectorAll('style')) style.remove()
    }
    // WHOLE_DOCUMENT returns an HTML element, not BODY. Never nest an
    // untrusted head/body inside the policy-controlled document.
    const body = root.querySelector('body') || root
    const styles = [...root.querySelectorAll('head style')].map(style => style.outerHTML).join('')
    return {html: styles + body.innerHTML, bodyStyle: body.getAttribute('style') || ''}
}

export function buildEmailDocument(html, protectReading = true) {
    const clean = prepareEmailHtml(html, {protectReading})
    const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(emailContentPolicy(protectReading))}"><meta name="referrer" content="no-referrer"><meta charset="utf-8"><style>html{color-scheme:light}body{margin:0;padding:0;background:#fff;color:#13181d;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}p{margin:0}a{color:#0e70df}table{max-width:100%}</style></head><body style="${escapeAttribute(clean.bodyStyle)}">${clean.html}</body></html>`
}
