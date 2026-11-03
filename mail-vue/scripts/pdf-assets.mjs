import {createRequire} from 'node:module'
import {dirname, join, basename} from 'node:path'
import {readFileSync, readdirSync} from 'node:fs'

// Ship every font/decoder with the app; the viewer never uses a public CDN.
export function pdfAssets() {
    const require = createRequire(import.meta.url)
    const root = dirname(require.resolve('pdfjs-dist/package.json'))
    const groups = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
    return {
        name: 'local-pdf-assets',
        generateBundle() {
            for (const group of groups) for (const file of readdirSync(join(root, group))) {
                if (/\.(bcmap|pfb|ttf|otf|wasm|icc|js)$/.test(file)) this.emitFile({type: 'asset', fileName: `pdfjs/${group}/${file}`, source: readFileSync(join(root, group, file))})
            }
            this.emitFile({type: 'asset', fileName: 'pdfjs/LICENSE', source: readFileSync(join(root, 'LICENSE'))})
        },
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const path = new URL(request.url, 'http://localhost').pathname
                const match = path.match(/^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/([^/]+)$/)
                if (!match || basename(match[2]) !== match[2] || !readdirSync(join(root, match[1])).includes(match[2])) return next()
                response.setHeader('Content-Type', path.endsWith('.wasm') ? 'application/wasm' : path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
                response.end(readFileSync(join(root, match[1], match[2])))
            })
        },
    }
}
