<template>
  <div class="box">
    <div class="header-actions">
      <Icon class="icon" icon="material-symbols-light:arrow-back-ios-new" width="20" height="20" @click="handleBack"/>
      <Icon v-perm="'email:delete'" class="icon" icon="uiw:delete" width="16" height="16" @click="handleDelete"/>
      <span class="star" v-if="emailStore.contentData.showStar">
        <Icon class="icon" @click="changeStar" v-if="email.isStar" icon="fluent-color:star-16" width="20" height="20"/>
        <Icon class="icon" @click="changeStar" v-else icon="solar:star-line-duotone" width="18.5" height="18.5"/>
      </span>
      <Icon class="icon" v-if="emailStore.contentData.showReply" v-perm="'email:send'"  @click="openReply" icon="fluent-mdl2:reply" width="19" height="19" />
      <Icon class="icon" v-if="emailStore.contentData.showReply" v-perm="'email:send'"  @click="openForward" icon="iconoir:arrow-up-right" width="20" height="20" />
      <EmailSource v-if="email.type === 0 && email.emailId" :email-id="email.emailId" :admin="emailStore.contentData.delType === 'physics'"/>
      <el-tooltip v-if="email.emailId" :content="t(readingProtected ? 'readingPrivacyOnTip' : 'readingPrivacyOffTip')" :trigger="['hover', 'focus']" :popper-style="{maxWidth: '280px'}">
        <button type="button" class="privacy-toggle" :class="{'is-protected': readingProtected}" :aria-label="t(readingProtected ? 'disableMailPrivacy' : 'enableMailPrivacy')" :aria-pressed="readingProtected" @click="temporaryPrivacy = !readingProtected">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <template v-if="readingProtected">
              <path d="M12 3 4.5 6v5.2c0 4.6 3.1 7.8 7.5 9.8 4.4-2 7.5-5.2 7.5-9.8V6L12 3Z"/>
              <path d="m8.5 12 2.3 2.3 4.7-4.8"/>
            </template>
            <template v-else>
              <path d="m3 3 18 18M9.3 4.1 12 3l7.5 3v5.2c0 1.1-.2 2.1-.5 3M4.5 6v5.2c0 4.6 3.1 7.8 7.5 9.8 1.6-.7 3-1.6 4.1-2.6"/>
            </template>
          </svg>
        </button>
      </el-tooltip>
    </div>
    <div></div>
    <el-scrollbar class="scrollbar">
      <div class="container">
        <div class="email-title">
          {{ email.subject }}
        </div>
        <div class="content">
          <div class="email-info">
            <div>
              <div class="send"><span class="send-source">{{$t('from')}}</span>
                <div class="send-name" ref="sendNameRef" :class="{ 'is-wrapped': senderWrapped }">
                  <span class="send-name-title">{{ email.name }}</span>
                  <span class="send-email"><{{ email.sendEmail }}></span>
                  <span class="sent-via" v-if="sentViaEmail">
                    <el-tooltip effect="dark" :content="$t('sentVia', { email: sentViaEmail })">
                      <span>
                        <el-tag size="small" disable-transitions>{{ $t('sentViaTag') }}</el-tag>
                      </span>
                    </el-tooltip>
                  </span>
                </div>
              </div>
              <div class="receive"><span class="source">{{$t('recipient')}}</span><span class="receive-email">{{  formateReceive(email.recipient) }}</span></div>
              <div class="date">
                <div>{{ formatDetailDate(email.createTime) }}</div>
              </div>
              <div class="tracking-status" v-if="email.type === 1 && (email.openCount || email.clickCount)">
                <OpenEventsPopover
                    v-if="email.openCount"
                    :email-id="email.emailId"
                    :open-count="email.openCount"
                    :admin="emailStore.contentData.delType === 'physics'"
                >
                  <el-tag type="primary" effect="plain" class="tracking-tag">
                    {{ $t('possiblyOpened') }} · {{ email.openCount }} · {{ formatDetailDate(email.lastOpenedAt) }}
                  </el-tag>
                </OpenEventsPopover>
                <el-tag v-if="email.clickCount" type="success" effect="plain">
                  {{ $t('linkClicked') }} · {{ email.clickCount }} · {{ formatDetailDate(email.lastClickedAt) }}
                </el-tag>
              </div>
            </div>
            <el-alert v-if="email.status === 3" :closable="false" :title="toMessage(email.message)" class="email-msg" type="error" show-icon />
            <el-alert v-if="email.status === 4" :closable="false" :title="$t('complained')" class="email-msg" type="warning" show-icon />
            <el-alert v-if="email.status === 5" :closable="false" :title="$t('delayed')" class="email-msg" type="warning" show-icon />
          </div>
          <el-scrollbar class="htm-scrollbar" :class="!email.attList?.length ? 'bottom-distance' : ''">
            <ShadowHtml class="shadow-html" :html="formatImage(email.content)" :protect-reading="readingProtected" v-if="email.content" />
            <pre v-else class="email-text" >{{email.text}}</pre>
          </el-scrollbar>
          <div class="att" v-if="email.attList?.length > 0">
            <div class="att-title">
              <span>{{$t('attachments')}}</span>
              <span>{{$t('attCount',{total: email.attList.length})}}</span>
            </div>
            <div class="att-box">

              <div class="att-item" v-for="att in email.attList" :key="att.attId">
                <div class="att-icon" @click="showImage(att.key)">
                  <Icon v-bind="getIconByName(att.filename)" />
                </div>
                <div class="att-name" @click="showImage(att.key)">
                  {{ att.filename }}
                </div>
                <div class="att-size">{{ formatBytes(att.size) }}</div>
                <div class="opt-icon att-icon">
                  <Icon v-if="isImage(att.filename)" icon="hugeicons:view" width="22" height="22" @click="showImage(att.key)"/>
                  <a :href="cvtR2Url(att.key)" download>
                    <Icon icon="system-uicons:push-down" width="22" height="22"/>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <el-image-viewer
        v-if="showPreview"
        :url-list="srcList"
        show-progress
        @close="showPreview = false"
    />
  </div>
</template>
<script setup>
import ShadowHtml from '@/components/shadow-html/index.vue'
import {computed, reactive, ref, watch, onMounted, onUnmounted, nextTick} from "vue";
import {useRouter} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {emailDelete, emailRead, permanentDeleteEmails, restoreEmails} from "@/request/email.js";
import {Icon} from "@iconify/vue";
import {useEmailStore} from "@/store/email.js";
import {useAccountStore} from "@/store/account.js";
import {formatDetailDate} from "@/utils/day.js";
import {starAdd, starCancel} from "@/request/star.js";
import {getExtName, formatBytes} from "@/utils/file-utils.js";
import {cvtR2Url,toOssDomain} from "@/utils/convert.js";
import {getIconByName} from "@/utils/icon-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {allEmailDelete} from "@/request/all-email.js";
import {useUiStore} from "@/store/ui.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";
import OpenEventsPopover from '@/components/open-events-popover/index.vue'
import EmailSource from '@/components/email-source/index.vue'
import {usePrivacyStore} from '@/store/privacy.js'
const { t } = useI18n()

const uiStore = useUiStore();
const privacy = usePrivacyStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const router = useRouter()
const sendNameRef = ref(null)
const senderWrapped = ref(false)
let senderResizeObserver = null

const showPreview = ref(false)
const srcList = reactive([])


const email = computed(() => emailStore.contentData.email || {
  emailId: 0,
  attList: [],
  content: '',
  text: '',
  recipient: '[]',
})

const temporaryPrivacy = ref(null)
const readingProtected = computed(() => temporaryPrivacy.value ?? privacy.protectReading)
// Only this open message is overridden. Leaving it restores the default.
watch(() => [email.value.emailId, emailStore.contentData.delType, privacy.accountKey, privacy.protectReading], () => {
  temporaryPrivacy.value = null
}, {flush: 'sync'})
// This detail view is not kept alive: leaving discards the local override.
// Do not reset before navigation, which could reload images while it unmounts.

const sentViaEmail = computed(() => {
  const raw = String(email.value.senderEmail || '').trim()
  if (!raw) return ''
  const matched = raw.match(/<([^>]+)>/)
  const address = (matched ? matched[1] : raw).trim()
  if (!address || address.toLowerCase() === String(email.value.sendEmail || '').trim().toLowerCase()) return ''
  return address
})

watch(() => accountStore.currentAccountId, () => {
  handleBack()
})

let readRequesting = false

function contentWidth(el) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const width = range.getBoundingClientRect().width
  range.detach()
  return width
}

function updateSenderWrap() {
  const root = sendNameRef.value
  if (!root) return
  const name = root.querySelector('.send-name-title')
  const mail = root.querySelector('.send-email')
  const tag = root.querySelector('.sent-via')
  if (!name || !mail) {
    senderWrapped.value = false
    return
  }
  const gap = 6
  let need = contentWidth(name) + gap + contentWidth(mail)
  if (tag) need += gap + contentWidth(tag)
  senderWrapped.value = need > root.clientWidth + 0.5
}


function tryMarkRead() {
  if (!emailStore.contentData.showUnread || readRequesting) return
  const current = email.value
  if (!current?.emailId || current.unread !== EmailUnreadEnum.UNREAD) return

  // 等详情数据就绪（detailMap 已写入，或正文已有内容）再标已读
  const full = emailStore.detailMap[current.emailId]
  const detailReady = !!full || !!(current.content || current.text)
  if (!detailReady) return

  readRequesting = true
  const emailId = current.emailId
  current.unread = EmailUnreadEnum.READ
  if (emailStore.detailMap[emailId]) {
    emailStore.detailMap[emailId].unread = EmailUnreadEnum.READ
  }
  emailStore.markListRead(emailId)
  emailRead([emailId]).finally(() => {
    readRequesting = false
  })
}

watch(
  () => [
    email.value?.emailId,
    email.value?.content,
    email.value?.text,
    emailStore.detailMap[email.value?.emailId]
  ],
  () => tryMarkRead(),
  { flush: 'post' }
)

watch(
  () => [email.value?.name, email.value?.sendEmail, sentViaEmail.value],
  () => nextTick(updateSenderWrap)
)

onMounted(() => {
  tryMarkRead()
  window.addEventListener('keydown', handleKeyDown);
  senderResizeObserver = new ResizeObserver(() => updateSenderWrap())
  if (sendNameRef.value) senderResizeObserver.observe(sendNameRef.value)
  nextTick(updateSenderWrap)
})

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
  readRequesting = false
  window.removeEventListener('keydown', handleKeyDown);
  senderResizeObserver?.disconnect()
})

function handleKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (showPreview.value) return;
  if (document.querySelector('.el-message-box')) return;
  if ([...document.querySelectorAll('.el-dialog')].some(dialog => dialog.getClientRects().length)) return;
  const writeBox = document.querySelector('.write-box');
  if (writeBox && writeBox.offsetParent !== null) return;
  handleBack();
}

function openReply() {
  uiStore.writerRef.openReply(email.value)
}

function openForward() {
  uiStore.writerRef.openForward(email.value)
}

function toMessage(message) {
  return  message ? JSON.parse(message).message : '';
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return  content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key)
  srcList.length = 0
  srcList.push(url)
  showPreview.value = true
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif','jfif'].includes(getExtName(filename))
}

function formateReceive(recipient) {
  if (!recipient) return ''
  recipient = JSON.parse(recipient)
  return recipient.map(item => item.address).join(', ')
}

function changeStar() {
  if (email.value.isStar) {
    email.value.isStar = 0;
    starCancel(email.value.emailId).then(() => {
      email.value.isStar = 0;
      emailStore.cancelStarEmailId = email.value.emailId
      setTimeout(() => emailStore.cancelStarEmailId = 0)
      emailStore.starScroll?.deleteEmail([email.value.emailId])
    }).catch((e) => {
      console.error(e)
      email.value.isStar = 1;
    })
  } else {
    email.value.isStar = 1;
    starAdd(email.value.emailId).then(() => {
      email.value.isStar = 1;
      emailStore.addStarEmailId = email.value.emailId
      setTimeout(() => emailStore.addStarEmailId = 0)
      emailStore.starScroll?.addItem(email.value)
    }).catch((e) => {
      console.error(e)
      email.value.isStar = 0;
    })
  }
}

const handleBack = () => {
  router.back()
}

const handleDelete = () => {
  const isTrash = emailStore.contentData.delType === 'trash'
  ElMessageBox.confirm(t(isTrash ? 'permanentDeleteConfirm' : 'delEmailConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    if (isTrash) {
      permanentDeleteEmails([email.value.emailId]).then(() => {
        ElMessage({ message: t('delSuccessMsg'), type: 'success', plain: true })
        emailStore.deleteIds = [email.value.emailId]
      })
    } else if (emailStore.contentData.delType === 'logic') {
      emailDelete(email.value.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.value.emailId]
      })
    } else  {

      allEmailDelete(email.value.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.value.emailId]
      })
    }

    router.back()
  })
}
</script>
<style scoped lang="scss">
.tracking-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tracking-tag {
  cursor: pointer;
}

.box {
  height: 100%;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px 9px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;
  .star {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
  }
  .icon {
    cursor: pointer;
  }
}

.privacy-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;

  &.is-protected, &:hover {color: var(--el-color-primary);}
  &:focus-visible {outline: 2px solid var(--el-color-primary); outline-offset: 4px;}
}


.scrollbar {
  height: calc(100% - 38px);
  width: 100%;
}

.container {
  font-size: 14px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 10px;
  @media (max-width: 1023px) {
    padding-left: 15px;
    padding-right: 15px;
  }

  .email-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .htm-scrollbar {
  }

  .content {
    display: flex;
    flex-direction: column;

    .att {
      margin-top: 30px;
      margin-bottom: 30px;
      border: 1px solid var(--light-border-color);
      padding: 14px;
      border-radius: 6px;
      width: fit-content;
      .att-box {
        min-width: min(410px,calc(100vw - 60px));
        max-width: 600px;
        display: grid;
        gap: 12px;
        grid-template-rows: 1fr;
      }

      .att-title {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        span:first-child {
          font-weight: bold;
        }
      }

      .att-item {
        cursor: pointer;
        div {
          align-self: center;
        }
        background: var(--light-ill);
        padding: 5px 7px;
        border-radius: 4px;
        align-self: start;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        .att-icon {
          display: grid;
        }

        .att-size {
          color: var(--secondary-text-color);
        }

        .att-name {
          margin-left: 8px;
          margin-right: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-all;
        }

        .att-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }

        .opt-icon {
          padding-left: 10px;
          color: var(--secondary-text-color);
          align-items: center;
          display: flex;
          gap: 8px;
          cursor: pointer;
          a {
            color: var(--secondary-text-color);
            align-items: center;
            display: flex;
          }
        }
      }
    }

    .email-info {

      border-bottom: 1px solid var(--light-border-color);
      margin-bottom: 20px;
      padding-bottom: 8px;
      @media (max-width: 1024px) {
        margin-bottom: 15px;
      }
      .date {
        color: var(--regular-text-color);
        margin-bottom: 6px;
      }

      .email-msg {
        max-width: 400px;
        width: fit-content;
        margin-bottom: 15px;
      }

      .send {
        display: flex;
        margin-bottom: 6px;

        .send-name {
          color: var(--regular-text-color);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          column-gap: 6px;

          .send-email {
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          &.is-wrapped {
            .send-name-title {
              order: 1;
            }

            .sent-via {
              order: 2;
            }

            .send-email {
              order: 3;
              flex-basis: 100%;
            }
          }
        }
      }

      .receive {
        margin-bottom: 6px;
        display: flex;
        .receive-email {
          max-width: 700px;
          word-break: break-word;
        }
        span:nth-child(2) {
          color: var(--regular-text-color);
        }
      }

      .send-source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }

      .source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }
    }
  }
}

.shadow-html::after  {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--message-block-color); /* 半透明黑色蒙层 */
  pointer-events: none; /* 不影响点击 */
}

.email-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}


</style>
