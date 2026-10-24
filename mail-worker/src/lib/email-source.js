const SOURCE_HEADERS = new Set(['from', 'to', 'date', 'received', 'authentication-results', 'arc-authentication-results', 'received-spf', 'return-path', 'reply-to', 'message-id', 'x-originating-ip', 'dkim-signature'])
const MAX_CHARS = 32768

export function captureSourceHeaders(parsed) {
    const headers = []
    let remaining = MAX_CHARS
    for (const entry of parsed.headers || []) {
        const name = String(entry.key || '').toLowerCase()
        if (!SOURCE_HEADERS.has(name) || remaining <= 0 || headers.length >= 128) continue
        const value = String(entry.value || '').replace(/\r?\n[ \t]+/g, ' ').slice(0, Math.min(4096, remaining))
        remaining -= value.length
        headers.push({name, value})
    }
    return JSON.stringify({version: 1, headers})
}

export function normalizePublicIp(value) {
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
        const octets = value.split('.').map(Number)
        if (octets.some(n => n > 255)) return null
        const [a, b, c] = octets
        if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
            || (a === 192 && b === 0 && (c === 0 || c === 2))
            || (a === 192 && b === 88 && c === 99)
            || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
            || (a === 203 && b === 0 && c === 113)) return null
        return octets.join('.')
    }
    if (!value.includes(':') || !/^[a-f\d:.]+$/i.test(value)) return null
    try {
        const ip = new URL(`http://[${value}]/`).hostname.slice(1, -1).toLowerCase()
        // Only global unicast candidates; never label local/mapped addresses as public.
        if (!/^[23]/.test(ip) || ip.startsWith('2001:db8:')) return null
        return ip
    } catch { return null }
}

export function describeSource(serialized) {
    if (!serialized) return {available: false, headers: [], candidates: []}
    let source
    try { source = JSON.parse(serialized) } catch { return {available: false, headers: [], candidates: []} }
    if (!source || source.version !== 1 || !Array.isArray(source.headers)) return {available: false, headers: [], candidates: []}
    const headers = source.headers.filter(h => h && SOURCE_HEADERS.has(h.name) && typeof h.value === 'string').slice(0, 128)
    const candidates = []
    const seen = new Set()
    let hop = 0
    for (const header of headers) {
        if (header.name !== 'received' && header.name !== 'x-originating-ip') continue
        if (header.name === 'received') hop++
        const tokens = header.value.match(/\[(?:IPv6:)?[^\]]+\]|\b\d{1,3}(?:\.\d{1,3}){3}\b/gi) || []
        for (const token of tokens) {
            const ip = normalizePublicIp(token.replace(/^\[(?:IPv6:)?|\]$/gi, ''))
            if (!ip || seen.has(ip)) continue
            seen.add(ip)
            candidates.push({ip, header: header.name, hop: header.name === 'received' ? hop : null})
        }
    }
    return {available: true, headers, candidates: candidates.slice(0, 40)}
}
