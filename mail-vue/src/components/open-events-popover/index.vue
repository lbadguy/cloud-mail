<template>
  <el-popover
      placement="bottom"
      :width="320"
      :popper-style="{maxWidth: 'calc(100vw - 24px)'}"
      trigger="click"
      @show="loadEvents"
  >
    <template #reference>
      <button
          type="button"
          class="open-events-trigger"
          :aria-label="t(isClick ? 'viewClickHistory' : 'viewOpenHistory')"
          @click.stop
      >
        <slot />
      </button>
    </template>

    <div class="open-events-popover" @click.stop>
      <div class="popover-heading">
        <strong>{{ t(isClick ? 'clickHistory' : 'openHistory') }}</strong>
        <span>{{ t(isClick ? 'clickedCount' : 'openedCount', { count: eventCount }) }}</span>
      </div>

      <el-skeleton v-if="loading" :rows="3" animated />
      <div v-else-if="loadFailed" class="load-failed">
        <span>{{ t(isClick ? 'clickHistoryLoadFailed' : 'openHistoryLoadFailed') }}</span>
        <el-button link type="primary" @click="loadEvents">{{ t('retry') }}</el-button>
      </div>
      <el-scrollbar v-else-if="events.length" max-height="240px">
        <ol class="event-list">
          <li v-for="(event, index) in events" :key="event.eventId">
            <span class="event-index">{{ events.length - index }}</span>
            <time :datetime="event.occurredAt">{{ formatDetailDate(event.occurredAt) }}</time>
          </li>
        </ol>
      </el-scrollbar>
      <el-empty v-else :image-size="52" :description="t(isClick ? 'noClickHistory' : 'noOpenHistory')" />

      <p class="tracking-note">{{ t(isClick ? 'trackingClickNotice' : 'trackingPixelNotice') }}</p>
    </div>
  </el-popover>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {formatDetailDate} from '@/utils/day.js'
import {emailOpenEvents, emailClickEvents} from '@/request/email.js'
import {allEmailOpenEvents, allEmailClickEvents} from '@/request/all-email.js'

const props = defineProps({
  emailId: {
    type: Number,
    required: true,
  },
  openCount: {
    type: Number,
    default: 0,
  },
  clickCount: {type: Number, default: 0},
  eventType: {type: String, default: 'open', validator: value => ['open', 'click'].includes(value)},
  admin: {
    type: Boolean,
    default: false,
  },
})

const {t} = useI18n()
const isClick = computed(() => props.eventType === 'click')
const eventCount = computed(() => isClick.value ? props.clickCount : props.openCount)
const events = ref([])
const loading = ref(false)
const loadFailed = ref(false)

let requestVersion = 0
watch(() => [props.emailId, props.admin, props.eventType], () => {
  requestVersion++
  events.value = []
  loading.value = false
  loadFailed.value = false
})

async function loadEvents() {
  if (loading.value) return
  const version = ++requestVersion
  loading.value = true
  loadFailed.value = false

  try {
    const request = isClick.value
        ? (props.admin ? allEmailClickEvents : emailClickEvents)
        : (props.admin ? allEmailOpenEvents : emailOpenEvents)
    const data = await request(props.emailId)
    if (version === requestVersion) events.value = data
  } catch (error) {
    if (version === requestVersion) {
      loadFailed.value = true
      events.value = []
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
</script>

<style scoped lang="scss">
.open-events-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  color: inherit;
  font: inherit;
  line-height: inherit;
  background: transparent;
  cursor: pointer;
}

.open-events-trigger:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.open-events-popover {
  color: var(--el-text-color-primary);
}

.popover-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.event-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 2px 4px 2px 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }
}

.event-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-size: 12px;
}

.load-failed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  color: var(--el-text-color-secondary);
}

.tracking-note {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
