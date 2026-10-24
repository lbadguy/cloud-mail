// A presentation summary of saved header claims, not a verifier or IP lookup.
function clauses(value = '') {
    const parts = []
    let part = '', quoted = false, escaped = false, comments = 0
    for (const char of value) {
        if (escaped) { if (!comments) part += char; escaped = false; continue }
        if (char === '\\') { escaped = true; if (!comments) part += char; continue }
        if (char === '"' && !comments) quoted = !quoted
        if (!quoted && char === '(') { comments++; continue }
        if (!quoted && char === ')' && comments) { comments--; continue }
        if (comments) continue
        if (char === ';' && !quoted) { parts.push(part.trim()); part = ''; continue }
        part += char
    }
    parts.push(part.trim())
    return parts
}

function status(records) {
    const results = [...new Set(records.map(record => record.result))]
    if (!results.length) return 'unknown'
    return results.length === 1 ? results[0] : 'mixed'
}

export function summarizeEmailSource(source) {
    const headers = (Array.isArray(source?.headers) ? source.headers : []).filter(header => header && typeof header.name === 'string' && typeof header.value === 'string')
    const first = name => headers.find(header => header.name.toLowerCase() === name)?.value || ''
    const received = first('received')
    const server = received.match(/^from\s+([^\s(]+)/i)?.[1] || ''
    const auth = first('authentication-results') || first('arc-authentication-results')
    const parts = clauses(auth)
    const records = parts.flatMap(part => {
        const match = part.match(/^(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror|policy|bestguesspass)\b/i)
        return match ? [{method: match[1].toLowerCase(), result: match[2].toLowerCase(), value: part}] : []
    })
    let spf = records.filter(record => record.method === 'spf')
    // SPF may report HELO=none and MAIL FROM=pass in the same header.
    const mailFrom = spf.filter(record => /\bsmtp\.mailfrom\s*=/i.test(record.value))
    if (mailFrom.length) spf = mailFrom
    if (!spf.length) {
        const result = first('received-spf').match(/^\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b/i)?.[1]
        if (result) spf = [{result: result.toLowerCase()}]
    }
    const dkim = records.filter(record => record.method === 'dkim')
    const domains = [...new Set(dkim.flatMap(record => {
        const match = record.value.match(/\bheader\.d\s*=\s*(?:"([^"\s]+)"|([^\s;]+))/i)
        return match ? [match[1] || match[2]] : []
    }))]
    return {
        server,
        ips: [...new Set((Array.isArray(source?.candidates) ? source.candidates : []).map(candidate => candidate?.ip).filter(ip => typeof ip === 'string' && ip))],
        authServer: parts.find(part => /^[\w.-]+(?:\s+\d+)?$/.test(part)) || '',
        authentication: {spf: status(spf), dkim: status(dkim), dmarc: status(records.filter(record => record.method === 'dmarc'))},
        signingDomains: domains,
    }
}
