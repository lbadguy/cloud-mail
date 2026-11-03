import mammoth from 'mammoth/mammoth.browser.js'
import readXlsxFile from 'read-excel-file/web-worker'
import {validateOfficeArchive} from '../utils/preview-archive.js'

// Parsing must never fetch a relationship, linked image, or external workbook.
const blocked = () => { throw new Error('External resources are disabled') }
globalThis.fetch = blocked
globalThis.XMLHttpRequest = class { constructor() { blocked() } }
globalThis.WebSocket = class { constructor() { blocked() } }

self.onmessage = async ({data: {kind, buffer}}) => {
    try {
        validateOfficeArchive(buffer)
        if (kind === 'docx') {
            const result = await mammoth.convertToHtml({arrayBuffer: buffer}, {
                externalFileAccess: false,
                convertImage: mammoth.images.imgElement(async image => {
                    if (!/^image\/(png|jpeg|gif|webp|bmp|avif)$/.test(image.contentType)) return {}
                    return {src: `data:${image.contentType};base64,${await image.read('base64')}`}
                }),
            })
            if (result.value.length > 12 * 1024 * 1024) throw new Error('previewTooComplex')
            self.postMessage({html: result.value})
        } else if (kind === 'xlsx') {
            const workbook = await readXlsxFile(new Uint8Array(buffer))
            if (workbook.length > 50) throw new Error('previewTooComplex')
            const sheets = workbook.map(({sheet, data}) => ({
                name: sheet,
                truncated: data.length > 500 || data.some(row => row.length > 100),
                rows: data.slice(0, 500).map(row => row.slice(0, 100).map(cell => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? ''))),
            }))
            self.postMessage({sheets})
        } else throw new Error('previewUnsupported')
    } catch (error) {
        self.postMessage({error: ['previewTooComplex','previewUnsupported'].includes(error.message) ? error.message : 'previewLoadError'})
    }
}
