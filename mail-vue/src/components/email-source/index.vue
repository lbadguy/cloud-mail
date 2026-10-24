<template>
  <el-collapse class="email-source" v-model="expanded">
    <el-collapse-item :title="t('emailSourceTitle')" name="source">
      <p class="source-note">{{t('emailSourceNotice')}}</p>
      <el-skeleton v-if="loading" :rows="2" animated/>
      <div v-else-if="failed">
        {{t('emailSourceFailed')}}
        <el-button link type="primary" @click="load">{{t('retry')}}</el-button>
      </div>
      <p v-else-if="!source?.available">{{t('emailSourceMissing')}}</p>
      <template v-else>
        <strong>{{t('emailSourceIps')}}</strong>
        <ul v-if="source.candidates.length">
          <li v-for="candidate in source.candidates" :key="candidate.ip">
            <code>{{candidate.ip}}</code> — {{candidate.header}}{{candidate.hop ? ` #${candidate.hop}` : ''}}
          </li>
        </ul>
        <p v-else>{{t('emailSourceNoIp')}}</p>
        <p class="source-note">{{t('emailSourceNoGeo')}}</p>
        <details>
          <summary>{{t('emailSourceHeaders')}}</summary>
          <dl>
            <template v-for="(header, index) in source.headers" :key="index">
              <dt>{{header.name}}</dt>
              <dd>{{header.value}}</dd>
            </template>
          </dl>
        </details>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup>
import {ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {emailSource} from '@/request/email.js'

const props = defineProps({emailId: {type: Number, required: true}, admin: Boolean})
const {t} = useI18n()
const expanded = ref([])
const source = ref(null)
const loading = ref(false)
const failed = ref(false)
let generation = 0

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
// No request on mailbox lists; source information is fetched only in a detail view.
watch(() => [props.emailId, props.admin], () => {
  expanded.value = []
  if (props.emailId) load()
}, {immediate: true})
</script>

<style scoped>
.email-source {margin: 12px 0; width: 100%; min-width: 0;}
.source-note {color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.7; margin: 8px 0;}
li {overflow-wrap: anywhere;}
dt {font-weight: 600; margin-top: 10px;}
dd {margin: 4px 0; white-space: pre-wrap; overflow-wrap: anywhere;}
summary {cursor: pointer; margin-top: 12px;}
</style>
