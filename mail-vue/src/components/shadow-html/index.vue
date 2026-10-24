<template>
  <iframe
      ref="frame"
      class="email-document"
      :title="t('emailBody')"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
      :srcdoc="documentHtml"
      :style="{height: `${height}px` }"
      @load="observeBody"
  />
</template>

<script setup>
import {computed, ref, onBeforeUnmount} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePrivacyStore} from '@/store/privacy.js'
import {buildEmailDocument} from '@/utils/email-html.js'

const props = defineProps({
  html: {type: String, required: true},
  protectReading: {type: Boolean, default: undefined},
})
const {t} = useI18n()
const privacy = usePrivacyStore()
const frame = ref(null)
const height = ref(320)
let observer
let resizeFrame
const documentHtml = computed(() => buildEmailDocument(props.html, props.protectReading ?? privacy.protectReading))

function observeBody() {
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
  const body = frame.value?.contentDocument?.body
  if (!body) return
  let updates = 0
  const resize = () => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      // Viewport-relative mail CSS must not grow the iframe forever. Very
      // large/pathological documents keep the iframe's native scroll fallback.
      const next = Math.min(30000, Math.max(100, Math.ceil(Math.max(body.scrollHeight, body.getBoundingClientRect().height))))
      if (next !== height.value && updates++ < 12) height.value = next
    })
  }
  observer = new ResizeObserver(resize)
  observer.observe(body)
  resize()
}
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
})
</script>

<style scoped>
.email-document {
  display: block;
  width: 100%;
  border: 0;
  background: #fff;
}
</style>
