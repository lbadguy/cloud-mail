// Local-only browser acceptance harness; never part of the production bundle.
import {createServer} from 'vite'
const hits = new Map()
const server = await createServer({
    server: {host: '127.0.0.1', port: 3001, strictPort: true},
    plugins: [{name: 'privacy-probe', configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
            const url = new URL(req.url, 'http://127.0.0.1:3001')
            if (url.pathname === '/test/probe/count') {
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
