<template>
  <div ref="root" class="pdf-page" :class="{'is-thumbnail': thumbnail}" :aria-busy="loading">
    <canvas ref="canvas" :aria-label="t('previewPage', {page})" role="img" />
    <div v-if="!thumbnail" ref="text" class="textLayer" />
    <span v-if="failed" class="page-error">{{ t('previewPageError') }}</span>
  </div>
</template>

<script setup>
import {onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {TextLayer, AnnotationMode} from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'

const props = defineProps({pdf: Object, page: Number, width: Number, zoom: {type: Number, default: 1}, thumbnail: Boolean})
const {t} = useI18n()
const root = ref(), canvas = ref(), text = ref()
const loading = ref(true), failed = ref(false)
let observer, renderTask, textTask, sequence = 0, visible = false

async function render() {
  if (!visible || !props.pdf || !canvas.value) return
  const current = ++sequence
  renderTask?.cancel()
  textTask?.cancel()
  loading.value = true
  failed.value = false
  try {
    const page = await props.pdf.getPage(props.page)
    if (current !== sequence) return
    const natural = page.getViewport({scale: 1})
    const scale = Math.min((props.width || 700) / natural.width * props.zoom, Math.sqrt(8_000_000 / (natural.width * natural.height)))
    const viewport = page.getViewport({scale})
    const ratio = props.thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)))
    // A new canvas avoids reusing one still owned by a cancelled PDF render.
    const target = document.createElement('canvas')
    target.width = Math.ceil(viewport.width * ratio)
    target.height = Math.ceil(viewport.height * ratio)
    target.style.width = `${viewport.width}px`
    target.style.height = `${viewport.height}px`
    renderTask = page.render({canvasContext: target.getContext('2d'), viewport, transform: ratio === 1 ? null : [ratio,0,0,ratio,0,0], annotationMode: AnnotationMode.DISABLE})
    await renderTask.promise
    if (current !== sequence) return
    const display = canvas.value
    display.width = target.width
    display.height = target.height
    display.style.width = target.style.width
    display.style.height = target.style.height
    display.getContext('2d').drawImage(target, 0, 0)
    target.width = target.height = 0
    root.value.style.width = `${viewport.width}px`
    root.value.style.height = `${viewport.height}px`
    if (!props.thumbnail && text.value) {
      text.value.replaceChildren()
      text.value.style.setProperty('--scale-factor', scale)
      text.value.style.setProperty('--total-scale-factor', scale)
      const textContentSource = await page.getTextContent()
      if (current !== sequence) return
      textTask = new TextLayer({textContentSource, container: text.value, viewport})
      await textTask.render()
    }
  } catch (error) {
    if (current === sequence && error.name !== 'RenderingCancelledException' && error.name !== 'AbortException') failed.value = true
  } finally { if (current === sequence) loading.value = false }
}
watch(() => [props.pdf, props.page, props.width, props.zoom], render)
onMounted(() => {
  if (!props.thumbnail) { visible = true; render(); return }
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { visible = true; observer.disconnect(); render() }
  }, {rootMargin: '150px'})
  observer.observe(root.value)
})
onBeforeUnmount(() => { sequence++; observer?.disconnect(); renderTask?.cancel(); textTask?.cancel() })
</script>

<style scoped>
.pdf-page {position:relative;flex:none;min-height:100px;background:#fff;box-shadow:0 2px 10px #0002;color:#303133;line-height:0}
.pdf-page canvas {display:block;max-width:none}
.is-thumbnail {min-height:160px;box-shadow:none;pointer-events:none}
.textLayer {inset:0;z-index:1}
.page-error {position:absolute;inset:30px 12px;line-height:1.5;font-size:13px}
</style>
