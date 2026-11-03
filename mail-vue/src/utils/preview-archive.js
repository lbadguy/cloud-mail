import {unzipSync, Unzip, UnzipInflate} from 'fflate'

export function validateOfficeArchive(buffer) {
    let expanded = 0
    let count = 0
    unzipSync(new Uint8Array(buffer), {filter(entry) {
        expanded += entry.originalSize
        if (++count > 2000 || expanded > 80 * 1024 * 1024 || entry.originalSize > 20 * 1024 * 1024) throw new Error('previewTooComplex')
        return false
    }})
    if (!count) throw new Error('previewLoadError')
    // Do not trust ZIP size declarations alone. Count actual output in bounded
    // compressed chunks before another parser is allowed to inflate the archive.
    let actual = 0
    const unzip = new Unzip(file => {
        let fileBytes = 0
        file.ondata = (error, data) => {
            if (error) throw error
            actual += data.byteLength
            fileBytes += data.byteLength
            if (actual > 80 * 1024 * 1024 || fileBytes > 20 * 1024 * 1024) throw new Error('previewTooComplex')
        }
        file.start()
    })
    unzip.register(UnzipInflate)
    const bytes = new Uint8Array(buffer)
    for (let index = 0; index < bytes.length; index += 16384) unzip.push(bytes.subarray(index,index+16384), index+16384 >= bytes.length)
}
