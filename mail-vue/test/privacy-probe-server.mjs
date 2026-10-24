// Local-only browser acceptance harness; never part of the production bundle.
import {createServer} from 'vite'
const hits = new Map()
const server = await createServer({
    define: {'import.meta.env.VITE_BASE_URL': JSON.stringify('/test/mock')},
    server: {host: '127.0.0.1', port: 3001, strictPort: true},
    plugins: [{name: 'privacy-probe', configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
            const url = new URL(req.url, 'http://127.0.0.1:3001')
            if (url.pathname === '/test/mock/email/source' || url.pathname === '/test/mock/allEmail/source') {
                hits.set(url.pathname, (hits.get(url.pathname) || 0) + 1)
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify({code:200, data:{available:true, headers:[
                    {name:'received',value:'from outbound.example.net (192.0.2.9) by mx.example.org'},
                    {name:'authentication-results',value:'mx.example.org; spf=none smtp.helo=outbound.example.net; spf=pass smtp.mailfrom=test@example.net; dkim=pass header.d=example.net; dmarc=pass header.from=example.net'},
                ],candidates:[{ip:'192.0.2.9'}]}}))
            } else if (url.pathname.startsWith('/test/mock/')) {
                res.statusCode = 400
                res.end('No production API calls allowed in this test')
            } else if (url.pathname === '/test/probe/count') {
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify(Object.fromEntries(hits)))
            } else if (url.pathname.startsWith('/test/probe/pixel/')) {
                hits.set(url.pathname, (hits.get(url.pathname) || 0) + 1)
                res.setHeader('Cache-Control', 'no-store')
                res.setHeader('Content-Type', 'image/gif')
                res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
            } else next()
        })
    }}],
})
await server.listen()
console.log('Local privacy acceptance: http://127.0.0.1:3001/test/privacy-browser.html')
