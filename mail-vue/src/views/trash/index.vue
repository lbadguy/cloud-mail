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
  </emailScroll>
</template>

<script setup>
import { ref } from 'vue'
import router from '@/router/index.js'
import emailScroll from '@/components/email-scroll/index.vue'
import { useEmailStore } from '@/store/email.js'
import { trashList, restoreEmails, permanentDeleteEmails } from '@/request/email.js'

const emailStore = useEmailStore()
const scroll = ref({})

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
</script>

<style scoped>
.trash-retention {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
</style>
