<template>
  <el-dialog v-model="opened" :title="attachment?.filename" class="attachment-preview-dialog" width="96%" top="3vh" :fullscreen="mobile" :close-on-click-modal="false" destroy-on-close>
    <template #header>
      <div class="preview-heading">
        <span class="preview-filename" :title="attachment?.filename">{{ attachment?.filename }}</span>
        <el-tooltip :content="t('previewPrivacyTip')" :trigger="['hover', 'focus']" :popper-style="{maxWidth:'280px'}">
          <button class="preview-icon privacy-info" type="button" :aria-label="t('previewPrivacy')"><PreviewIcon name="shield" size="19" /></button>
        </el-tooltip>
        <el-button v-if="buffer" text :aria-label="t('previewDownload')" @click="download"><PreviewIcon name="download" size="18" /><span>{{ t('previewDownload') }}</span></el-button>
      </div>
    </template>
    <div class="preview-shell" v-loading="loading">
      <div v-if="error" class="preview-empty" role="alert">
        <PreviewIcon name="warning" size="40" />
        <p>{{ t(error) }}</p>
        <el-button @click="load">{{ t('previewRetry') }}</el-button>
      </div>
      <template v-else-if="!loading">
        <div v-if="kind === 'pdf' && pdf" class="preview-toolbar">
          <el-button text :aria-label="t('previewThumbnails')" :aria-pressed="sidebar" @click="sidebar = !sidebar"><PreviewIcon name="sidebar" size="18" /></el-button>
          <div class="preview-pages">
            <el-button text :disabled="page <= 1" :aria-label="t('previewPrevious')" @click="page--"><PreviewIcon name="previous" size="18" /></el-button>
            <el-input-number v-model="page" :min="1" :max="pdf.numPages" :controls="false" size="small" :aria-label="t('previewPageNumber')" @change="value => page = value || 1" />
            <span>/ {{ pdf.numPages }}</span>
            <el-button text :disabled="page >= pdf.numPages" :aria-label="t('previewNext')" @click="page++"><PreviewIcon name="next" size="18" /></el-button>
          </div>
          <div class="preview-zoom">
            <el-button text :disabled="zoom <= 0.5" :aria-label="t('previewZoomOut')" @click="zoom = Math.max(0.5, zoom - 0.25)"><PreviewIcon name="minus" size="17" /></el-button>
            <span>{{ Math.round(zoom * 100) }}%</span>
            <el-button text :disabled="zoom >= 3" :aria-label="t('previewZoomIn')" @click="zoom = Math.min(3, zoom + 0.25)"><PreviewIcon name="plus" size="17" /></el-button>
            <el-button text :aria-label="t('previewFitWidth')" @click="zoom = 1"><PreviewIcon name="fit" size="18" /></el-button>
          </div>
        </div>
        <div v-if="kind === 'pdf' && pdf" class="preview-pdf">
          <aside v-if="sidebar" class="preview-thumbnails" :aria-label="t('previewThumbnails')">
            <button v-for="number in pdf.numPages" :key="number" class="preview-thumbnail" :class="{'is-current': page === number}" type="button" :aria-label="t('previewPage',{page:number})" :aria-current="page === number ? 'page' : undefined" @click="page = number">
              <PdfPage :pdf="pdf" :page="number" :width="130" thumbnail /><span>{{ number }}</span>
            </button>
          </aside>
          <div ref="viewport" class="preview-paper-area" @keydown.left.prevent="page = Math.max(1,page-1)" @keydown.right.prevent="page = Math.min(pdf.numPages,page+1)" tabindex="0" :aria-label="t('attachmentPreview')">
            <PdfPage :pdf="pdf" :page="page || 1" :width="paperWidth" :zoom="zoom" />
          </div>
        </div>
        <div v-else-if="kind === 'image'" class="preview-image"><img :src="imageUrl" :alt="attachment.filename" /></div>
        <template v-else>
          <div v-if="kind === 'docx' || kind === 'xlsx'" class="preview-document-note">
            {{ t(kind === 'docx' ? 'previewWordNote' : 'previewExcelNote') }}
          </div>
          <el-tabs v-if="kind === 'xlsx'" v-model="sheetIndex" class="preview-sheets">
            <el-tab-pane v-for="(sheet,index) in sheets" :key="index" :label="sheet.name" :name="String(index)" />
          </el-tabs>
          <p v-if="sheets[Number(sheetIndex)]?.truncated" class="preview-document-note">{{ t('previewSheetLimit') }}</p>
          <iframe class="preview-document" sandbox="" referrerpolicy="no-referrer" :srcdoc="frameHtml" :title="attachment.filename" />
        </template>
      </template>
    </div>
  </el-dialog>
</template>

<script setup>
import {computed, nextTick, onBeforeUnmount, ref, shallowRef, watch} from 'vue'
import {useMediaQuery, useResizeObserver} from '@vueuse/core'
import {useI18n} from 'vue-i18n'
import PreviewIcon from './preview-icon.vue'
import {useUiStore} from '@/store/ui.js'
import {MAX_PREVIEW_BYTES, MAX_TEXT_BYTES, decodeText, documentFrame, escapeHtml, isRasterImage, previewKind, readPreviewResponse} from '@/utils/attachment-preview.js'
import PdfPage from './pdf-page.vue'
import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl
const {t} = useI18n()
const ui = useUiStore()
const opened = defineModel({type:Boolean})
const props = defineProps({attachment:Object, emailId:Number, admin:Boolean})
const mobile = useMediaQuery('(max-width: 700px)')
const loading = ref(false), error = ref(''), kind = ref('')
const buffer = shallowRef(), pdf = shallowRef(), imageUrl = ref('')
const page = ref(1), zoom = ref(1), sidebar = ref(!mobile.value), viewport = ref(), paperWidth = ref(750)
const html = ref(''), sheets = shallowRef([]), sheetIndex = ref('0')
let controller, officeWorker, officeReject, loadingTask, sequence = 0

const frameHtml = computed(() => {
  if (kind.value !== 'xlsx') return documentFrame(html.value, ui.dark)
  const rows = sheets.value[Number(sheetIndex.value)]?.rows || []
  const table = rows.length ? `<table><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p>${escapeHtml(t('previewEmptySheet'))}</p>`
  return documentFrame(table, ui.dark)
})
useResizeObserver(viewport, entries => { paperWidth.value = Math.max(220, entries[0].contentRect.width - (mobile.value ? 24 : 64)) })

function release() {
  sequence++
  controller?.abort()
  officeReject?.(new DOMException('Cancelled','AbortError'))
  officeReject = undefined
  officeWorker?.terminate()
  officeWorker = undefined
  loadingTask?.destroy().catch(() => {})
  loadingTask = undefined
  pdf.value = undefined
  buffer.value = undefined
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  html.value = ''
  sheets.value = []
}

function parseOffice(bytes, type) {
  officeWorker = new Worker(new URL('../../workers/office-preview.worker.js', import.meta.url), {type:'module'})
  return new Promise((resolve, reject) => {
    const worker = officeWorker
    const timeout = setTimeout(() => finish(undefined, new Error('previewTooComplex')), 15000)
    function finish(value, failure) {
      clearTimeout(timeout)
      worker.terminate()
      if (officeWorker === worker) { officeWorker = undefined; officeReject = undefined }
      failure ? reject(failure) : resolve(value)
    }
    officeReject = failure => finish(undefined, failure)
    worker.onmessage = ({data}) => finish(data, data.error ? new Error(data.error) : undefined)
    worker.onerror = () => finish(undefined, new Error('previewLoadError'))
    const copy = bytes.slice(0)
    worker.postMessage({kind:type, buffer:copy}, [copy])
  })
}

async function load() {
  release()
  if (!opened.value || !props.attachment) return
  const current = sequence
  loading.value = true
  error.value = ''
  kind.value = previewKind(props.attachment.filename)
  page.value = 1
  zoom.value = 1
  sheetIndex.value = '0'
  sidebar.value = !mobile.value
  controller = new AbortController()
  const requestController = controller
  const timeout = setTimeout(() => {
    requestController.abort()
    if (current === sequence) loadingTask?.destroy().catch(() => {})
  }, 45000)
  try {
    if (!kind.value) throw new Error('previewUnsupported')
    if (props.attachment.size > MAX_PREVIEW_BYTES) throw new Error('previewTooLarge')
    const path = props.admin ? '/allEmail/attachmentPreview' : '/email/attachmentPreview'
    const url = `${import.meta.env.VITE_BASE_URL || '/api'}${path}?${new URLSearchParams({emailId:props.emailId,attId:props.attachment.attId})}`
    const response = await fetch(url, {headers:{Authorization:localStorage.getItem('token') || ''}, signal:controller.signal, cache:'no-store', redirect:'error', referrerPolicy:'no-referrer'})
    const bytes = await readPreviewResponse(response, controller.signal)
    if (current !== sequence) return
    buffer.value = bytes
    if (kind.value === 'pdf') {
      loadingTask = getDocument({data:new Uint8Array(bytes.slice(0)), isEvalSupported:false, enableXfa:false, useSystemFonts:true, maxImageSize:16_000_000, canvasMaxAreaInBytes:32*1024*1024,
        cMapUrl:`${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked:true, standardFontDataUrl:`${import.meta.env.BASE_URL}pdfjs/standard_fonts/`, wasmUrl:`${import.meta.env.BASE_URL}pdfjs/wasm/`, iccUrl:`${import.meta.env.BASE_URL}pdfjs/iccs/`})
      const result = await loadingTask.promise
      if (current !== sequence) return
      if (result.numPages > 500) throw new Error('previewTooComplex')
      pdf.value = result
    } else if (kind.value === 'image') {
      if (!isRasterImage(bytes)) throw new Error('previewLoadError')
      // Re-encode before displaying: never interpret an SVG/HTML file as a document.
      const bitmap = await createImageBitmap(new Blob([bytes]))
      if (bitmap.width * bitmap.height > 24_000_000) { bitmap.close(); throw new Error('previewTooComplex') }
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap,0,0)
      bitmap.close()
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      canvas.width = canvas.height = 0
      if (!blob) throw new Error('previewLoadError')
      if (current === sequence) imageUrl.value = URL.createObjectURL(blob)
    } else if (kind.value === 'text') {
      if (bytes.byteLength > MAX_TEXT_BYTES) throw new Error('previewTextTooLarge')
      html.value = `<pre>${escapeHtml(decodeText(bytes))}</pre>`
    } else {
      const result = await parseOffice(bytes, kind.value)
      if (current !== sequence) return
      html.value = result.html || ''
      sheets.value = result.sheets || []
    }
  } catch (failure) {
    if (current !== sequence) return
    error.value = failure.name === 'PasswordException' ? 'previewPassword' : ['previewTooLarge','previewTextTooLarge','previewTooComplex','previewUnsupported'].includes(failure.message) ? failure.message : 'previewLoadError'
    loadingTask?.destroy().catch(() => {})
    loadingTask = undefined
    pdf.value = undefined
  } finally {
    clearTimeout(timeout)
    if (current === sequence) loading.value = false
  }
}
function download() {
  if (!buffer.value) return
  const url = URL.createObjectURL(new Blob([buffer.value], {type:'application/octet-stream'}))
  const link = document.createElement('a')
  link.href = url; link.download = props.attachment.filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
watch(() => [opened.value, props.attachment?.attId, props.emailId, props.admin], () => { if (opened.value) nextTick(load); else release() }, {immediate:true})
onBeforeUnmount(release)
</script>

<style scoped>
.preview-heading {display:flex;align-items:center;gap:10px;min-width:0;padding-right:16px}
.preview-filename {font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.preview-heading .el-button {margin-left:auto;gap:5px;flex:none}
.preview-icon {display:inline-flex;align-items:center;justify-content:center;padding:2px;border:0;background:transparent;color:var(--el-text-color-secondary);cursor:help;flex:none}
button:focus-visible,.preview-paper-area:focus-visible {outline:2px solid var(--el-color-primary);outline-offset:2px}
.preview-shell {height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--el-fill-color-light)}
.preview-toolbar {display:flex;align-items:center;gap:12px;padding:6px 12px;flex:none;border-bottom:1px solid var(--el-border-color);background:var(--el-bg-color)}
.preview-pages,.preview-zoom {display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums;white-space:nowrap;font-size:13px}
.preview-zoom {margin-left:auto}
.preview-pages .el-input-number {width:58px}
.preview-toolbar .el-button {margin:0;padding:7px}
.preview-pdf {display:flex;flex:1;min-height:0}
.preview-thumbnails {width:174px;flex:none;overflow:auto;padding:16px 12px;border-right:1px solid var(--el-border-color)}
.preview-thumbnail {display:flex;flex-direction:column;align-items:center;gap:8px;border:2px solid transparent;border-radius:4px;padding:8px;margin:0 0 14px;width:100%;background:transparent;color:var(--el-text-color-regular);cursor:pointer;font-variant-numeric:tabular-nums;font-size:12px}
.preview-thumbnail.is-current {border-color:var(--el-color-primary);background:var(--el-color-primary-light-9)}
.preview-thumbnail:hover {background:var(--el-fill-color)}
.preview-paper-area {flex:1;min-width:0;overflow:auto;padding:24px 32px;display:flex;align-items:flex-start}
.preview-paper-area :deep(.pdf-page) {margin-inline:auto}
.preview-image {display:flex;align-items:center;justify-content:center;flex:1;overflow:auto;padding:24px}
.preview-image img {max-width:100%;max-height:100%;object-fit:contain}
.preview-document {border:0;flex:1;width:100%;min-height:0;background:var(--el-bg-color)}
.preview-document-note {padding:9px 16px;margin:0;color:var(--el-text-color-regular);font-size:12px;background:var(--el-bg-color);border-bottom:1px solid var(--el-border-color)}
.preview-sheets {background:var(--el-bg-color);padding-inline:16px;flex:none}
.preview-sheets :deep(.el-tabs__header) {margin:0}
.preview-empty {margin:auto;text-align:center;padding:24px;max-width:420px;color:var(--el-text-color-secondary);line-height:1.7}
:global(.attachment-preview-dialog) {display:flex;flex-direction:column;height:94dvh;max-height:94dvh;box-sizing:border-box;margin-bottom:0}
:global(.attachment-preview-dialog .el-dialog__body) {padding:0;flex:1;min-height:0;overflow:hidden}
:global(.attachment-preview-dialog .el-dialog__header) {padding-bottom:12px;margin-right:20px;flex:none}
:global(.attachment-preview-dialog.is-fullscreen) {height:100dvh;max-height:100dvh;margin:0}
@media(max-width:700px){
  .preview-heading {gap:5px;padding-right:0}
  .preview-heading .el-button span {display:none}
  .preview-toolbar {gap:2px;padding:5px 4px}
  .preview-pages,.preview-zoom {gap:2px}
  .preview-toolbar .el-button {padding:5px}
  .preview-thumbnails {width:116px;padding:12px 5px}
  .preview-thumbnail {overflow:hidden;align-items:center;padding:5px 0}
  .preview-thumbnail :deep(.pdf-page) {transform:scale(.7);transform-origin:top center;margin-bottom:-55px}
  .preview-paper-area {padding:12px}
}
</style>
