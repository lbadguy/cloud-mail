<template>
  <emailScroll
      ref="scroll"
      type="trash"
      trash
      :get-email-list="getEmailList"
      :email-delete="permanentDeleteEmails"
      :email-restore="restoreEmails"
      :show-star="false"
      :show-unread="false"
      :show-account-icon="false"
      action-left="4px"
      @jump="jumpContent"
  >
    <template #first>
      <span class="trash-retention">{{ $t('trashRetention') }}</span>
    </template>
    <template #subject="{ email }">
      <span class="trash-subject">
        <span class="trash-remaining">{{ $t('trashDaysRemaining', { days: remainingDays(email.deletedAt) }) }}</span>
        <span class="trash-subject-text">{{ email.subject || '(' + $t('noSubject') + ')' }}</span>
      </span>
    </template>
  </emailScroll>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import router from '@/router/index.js'
import emailScroll from '@/components/email-scroll/index.vue'
import { useEmailStore } from '@/store/email.js'
import { trashList, restoreEmails, permanentDeleteEmails } from '@/request/email.js'

const emailStore = useEmailStore()
const scroll = ref({})

const TRASH_RETENTION_DAYS = 30
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const currentTime = ref(Date.now())
let countdownTimer

onMounted(() => {
  countdownTimer = setInterval(() => {
    currentTime.value = Date.now()
  }, 60 * 1000)
})

onUnmounted(() => {
  clearInterval(countdownTimer)
})

function getEmailList(emailId, size) {
  return emailStore.fetchList(full => trashList(emailId, size, 0, full))
}

function jumpContent(email) {
  emailStore.contentData.email = emailStore.toContentEmail(email)
  emailStore.contentData.delType = 'trash'
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  router.push({ name: 'content' })
}

function remainingDays(deletedAt) {
  const deletedAtTime = parseDeletedAt(deletedAt)
  if (!Number.isFinite(deletedAtTime)) return TRASH_RETENTION_DAYS

  const expiresAt = deletedAtTime + TRASH_RETENTION_DAYS * DAY_IN_MILLISECONDS
  return Math.max(0, Math.ceil((expiresAt - currentTime.value) / DAY_IN_MILLISECONDS))
}

function parseDeletedAt(value) {
  if (!value) return NaN

  const text = String(value).trim()
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`
  return Date.parse(withTimezone)
}
</script>

<style scoped>
.trash-retention {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.trash-subject {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.trash-remaining {
  flex: 0 0 auto;
  color: var(--el-color-danger);
  font-size: 12px;
  font-weight: 500;
}

.trash-subject-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
