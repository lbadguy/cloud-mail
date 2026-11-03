import r2Service from './r2-service';

export const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

// Resolve by attachment ID and mail ownership, never by a caller-supplied URL.
export async function attachmentPreview(c, params, userId) {
    const emailId = Number(params.emailId);
    const attId = Number(params.attId);
    c.header('Cache-Control', 'no-store');
    if (![emailId, attId].every(id => Number.isSafeInteger(id) && id > 0)) return c.body(null, 404);
    const owned = userId !== undefined;
    const row = await c.env.db.prepare(`
        SELECT a.key, a.size FROM attachments a JOIN email e ON e.email_id = a.email_id
        WHERE a.att_id = ? AND a.email_id = ? AND a.type = 0 AND a.content_id IS NULL
        ${owned ? 'AND a.user_id = ? AND e.user_id = ?' : ''}
    `).bind(...(owned ? [attId, emailId, userId, userId] : [attId, emailId])).first();
    if (!row || !/^attachments\/[a-zA-Z0-9._-]+$/.test(row.key)) return c.body(null, 404);
    if (row.size > MAX_PREVIEW_BYTES) return c.body(null, 413);
    const source = await r2Service.toObjResp(c, row.key);
    if (!source?.ok || !source.body) return c.body(null, 404);
    let received = 0;
    const body = source.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > MAX_PREVIEW_BYTES) throw new Error('Preview size limit exceeded');
            controller.enqueue(chunk);
        },
    }));
    return new Response(body, {headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    }});
}
