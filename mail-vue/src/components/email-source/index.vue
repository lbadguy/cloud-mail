<template>
  <el-tooltip :content="t('emailSourceTitle')" :trigger="['hover', 'focus']">
    <button type="button" class="source-button" :aria-label="t('emailSourceTitle')" @click="visible = true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 19H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4M3 5l9 7 9-7"/>
        <circle cx="17" cy="16" r="4"/><path d="m20 19 2 2"/>
      </svg>
    </button>
  </el-tooltip>
  <el-dialog v-model="visible" :title="t('emailSourceTitle')" width="min(640px, calc(100vw - 32px))" append-to-body destroy-on-close>
    <div class="source-content">
      <el-skeleton v-if="loading" :rows="4" animated/>
      <div v-else-if="failed">
        {{t('emailSourceFailed')}}
        <el-button link type="primary" @click="load">{{t('retry')}}</el-button>
      </div>
      <p v-else-if="!source?.available">{{t('emailSourceMissing')}}</p>
      <template v-else>
        <dl class="source-summary">
          <dt>{{t('emailSourceServer')}}</dt><dd>{{summary.server || t('unknown')}}</dd>
          <dt>
            <el-tooltip :content="t('emailSourceIpHelp')" :trigger="['hover', 'focus']">
              <span tabindex="0">{{t('emailSourceIps')}}</span>
            </el-tooltip>
          </dt>
          <dd><code v-for="ip in summary.ips" :key="ip" class="source-ip">{{ip}}</code><span v-if="!summary.ips.length">{{t('emailSourceNoIp')}}</span></dd>
          <template v-if="summary.signingDomains.length">
            <dt>{{t('emailSourceSignedBy')}}</dt><dd>{{summary.signingDomains.join(', ')}}</dd>
          </template>
        </dl>
        <h3 class="auth-heading">
          {{t('emailSourceAuthentication')}}
          <el-tooltip :content="t('emailSourceNotice')" :trigger="['hover', 'focus']" :popper-style="{maxWidth: '280px'}">
            <button type="button" class="source-help" :aria-label="t('emailSourceAuthHelp')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/></svg>
            </button>
          </el-tooltip>
        </h3>
        <dl class="source-summary">
          <template v-for="method in ['spf', 'dkim', 'dmarc']" :key="method">
            <dt>
              <el-tooltip :content="t(`emailSource${method.toUpperCase()}Help`)" :trigger="['hover', 'focus']">
                <span tabindex="0">{{method.toUpperCase()}}</span>
              </el-tooltip>
            </dt>
            <dd><el-tag size="small" effect="plain" :type="statusType(summary.authentication[method])">{{t(`emailAuth_${summary.authentication[method]}`)}}</el-tag></dd>
          </template>
          <template v-if="summary.authServer">
            <dt>{{t('emailSourceCheckedBy')}}</dt><dd>{{summary.authServer}}</dd>
          </template>
        </dl>
        <details>
          <summary>{{t('emailSourceHeaders')}}</summary>
          <pre>{{rawHeaders}}</pre>
        </details>
      </template>
    </div>
  </el-dialog>
</template>

<script setup>
import {computed, onBeforeUnmount, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {emailSource} from '@/request/email.js'
import {summarizeEmailSource} from '@/utils/email-source-summary.js'

const props = defineProps({emailId: {type: Number, required: true}, admin: Boolean})
const {t} = useI18n()
const visible = ref(false)
const source = ref(null)
const loading = ref(false)
const failed = ref(false)
let generation = 0
const summary = computed(() => summarizeEmailSource(source.value))
const rawHeaders = computed(() => (source.value?.headers || []).map(header => `${header.name}: ${header.value}`).join('\n\n'))
const statusType = status => status === 'pass' ? 'success' : ['fail', 'permerror'].includes(status) ? 'danger' : ['softfail', 'mixed', 'temperror', 'policy'].includes(status) ? 'warning' : 'info'

async function load() {
  const current = ++generation
  source.value = null
  failed.value = false
  loading.value = true
  try {
    const data = await emailSource(props.emailId, props.admin)
    if (current === generation) source.value = data
  } catch {
    if (current === generation) failed.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(visible, open => { if (open && !source.value) load() })
// Fetch on demand; never retain another message's data in an open dialog.
watch(() => [props.emailId, props.admin], () => {
  generation++
  visible.value = false
  source.value = null
  loading.value = false
  failed.value = false
}, {flush: 'sync'})
onBeforeUnmount(() => generation++)
</script>

<style scoped>
.source-button, .source-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  &:focus-visible {outline: 2px solid var(--el-color-primary); outline-offset: 4px;}
}
.source-button {width: 20px; height: 20px;}
.source-button:hover {color: var(--el-color-primary);}
.source-help {color: var(--el-text-color-secondary);}
.source-content {max-height: 65vh; overflow: auto; font-size: 14px; line-height: 1.6;}
.source-summary {display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 12px 16px; margin: 0;}
dt {color: var(--el-text-color-secondary);}
dd {margin: 0; overflow-wrap: anywhere;}
.source-ip {display: block;}
.auth-heading {display: flex; align-items: center; gap: 8px; margin: 24px 0 12px; font-size: 14px; font-weight: 600;}
summary {cursor: pointer; margin-top: 24px; color: var(--el-color-primary);}
pre {max-height: 260px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px;}
@media (max-width: 480px) {.source-summary {grid-template-columns: 84px minmax(0, 1fr); gap: 10px 12px;}}
</style>
