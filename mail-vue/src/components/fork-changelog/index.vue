<template>
  <el-drawer
      v-model="visible"
      :title="t('forkChangelog')"
      size="min(680px, 100vw)"
      append-to-body
      destroy-on-close
      class="fork-changelog"
  >
    <div class="changelog-links">
      <a :href="repositoryUrl" target="_blank" rel="noopener noreferrer">lbadguy/cloud-mail</a>
      <a v-if="commits[0]" :href="commitUrl(commits[0].sha)" target="_blank" rel="noopener noreferrer">
        {{ t('deployedRevision') }} {{ commits[0].sha.slice(0, 7) }}
      </a>
    </div>
    <el-tabs v-model="tab">
      <el-tab-pane :label="t('forkFeatures')" name="features">
        <ul class="changelog-list feature-list">
          <li v-for="feature in featureList" :key="feature.id">
            <div class="entry-heading">
              <h3>{{ text(feature.title) }}</h3>
              <a v-if="feature.commit" :href="commitUrl(feature.commit.sha)" target="_blank" rel="noopener noreferrer" :aria-label="`${t('viewCommit')}: ${text(feature.title)}`">
                {{ feature.commit.date }}
              </a>
            </div>
            <p>{{ text(feature.description) }}</p>
          </li>
        </ul>
      </el-tab-pane>
      <el-tab-pane :label="t('forkCommits')" name="commits">
        <ul class="changelog-list commit-list">
          <li v-for="commit in commits" :key="commit.sha">
            <a class="commit-title" :href="commitUrl(commit.sha)" target="_blank" rel="noopener noreferrer">{{ text(commit.title) }}</a>
            <div class="commit-meta"><time :datetime="commit.date">{{ commit.date }}</time><code>{{ commit.sha.slice(0, 7) }}</code></div>
          </li>
        </ul>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup>
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {repositoryUrl} from '@/utils/project.js'
import {features} from '@/data/fork-history.js'

const visible = defineModel({type: Boolean, default: false})
const {t, locale} = useI18n()
const tab = ref('features')
const commits = __FORK_COMMITS__
const featureList = features.map(([id, revision, title, description]) => ({
  id, title, description,
  commit: commits.find(commit => commit.sha.startsWith(revision) || commit.subject === revision),
}))
const language = computed(() => String(locale.value).startsWith('en') ? 1 : 0)
const text = pair => pair[language.value]
const commitUrl = sha => `${repositoryUrl}/commit/${sha}`
</script>

<style scoped lang="scss">
.changelog-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 20px;
  font-size: 13px;
}

a {
  color: var(--el-color-primary);
  text-decoration: none;
  text-underline-offset: 3px;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }
}

.changelog-list {
  padding: 0;
  margin: 0;
  list-style: none;
  color: var(--el-text-color-primary);
  text-align: left;

  li {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    overflow-wrap: anywhere;
  }

  li:first-child { padding-top: 4px; }
  li:last-child { border-bottom: 0; }

  h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.6; }
  p { margin: 6px 0 0; color: var(--el-text-color-regular); font-size: 13px; line-height: 1.7; }
}

.entry-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;

  a { flex-shrink: 0; font-size: 12px; font-variant-numeric: tabular-nums; }
}

.commit-title { font-size: 14px; line-height: 1.6; }
.commit-meta {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
