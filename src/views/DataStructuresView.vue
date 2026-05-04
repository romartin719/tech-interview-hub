<script setup lang="ts">
import { ref, nextTick } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'

import { allTopics } from '@/data'
import { useProblemStore } from '@/stores/problemStore'
import StatsOverview from '@/components/ds/StatsOverview.vue'
import DashboardCard from '@/components/ds/DashboardCard.vue'
import PhaseAccordion from '@/components/ds/PhaseAccordion.vue'
import ResourceSection from '@/components/ds/ResourceSection.vue'

const store = useProblemStore()
const activeTab = ref(allTopics[0]?.id ?? '')
const tabsRef = ref<HTMLElement | null>(null)

function onSelectTopic(topicId: string) {
  activeTab.value = topicId
  nextTick(() => {
    tabsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function getTopicPercent(topicId: string) {
  const topic = allTopics.find((t) => t.id === topicId)
  if (!topic) return 0
  const stats = store.getTopicStats(topic)
  if (stats.total === 0) return 0
  return Math.round((stats.solved / stats.total) * 100)
}

function getTopicStats(topicId: string) {
  const topic = allTopics.find((t) => t.id === topicId)
  if (!topic) return { total: 0, solved: 0, attempted: 0, needsReview: 0, notStarted: 0 }
  return store.getTopicStats(topic)
}
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-sitemap"></i> Data Structures & Algorithms</h1>
      <p>Track your progress across all DSA topics for interviews and competitive programming</p>
    </div>

    <!-- Dashboard Stats -->
    <StatsOverview />

    <!-- Topic Cards Grid -->
    <h2 class="sub-heading">Topics</h2>
    <div class="topics-grid">
      <DashboardCard
        v-for="topic in allTopics"
        :key="topic.id"
        :topic="topic"
        @selectTopic="onSelectTopic"
      />
    </div>

    <!-- Tabbed Problem Tracker -->
    <div ref="tabsRef" class="tabs-section">
      <h2 class="sub-heading">Problem Tracker</h2>
      <Tabs :value="activeTab" @update:value="(v: string | number) => activeTab = String(v)" scrollable>
        <TabList>
          <Tab v-for="topic in allTopics" :key="topic.id" :value="topic.id">
            {{ topic.name }}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="topic in allTopics" :key="topic.id" :value="topic.id">
            <!-- Placeholder Topics -->
            <div v-if="topic.placeholder" class="placeholder-content">
              <i class="pi pi-clock" style="font-size: 2rem; color: var(--p-text-muted-color)"></i>
              <h3>{{ topic.name }} - Coming Soon</h3>
              <p>{{ topic.description }}</p>
              <p class="placeholder-note">Problem list and resources will be added in a future update.</p>
            </div>

            <!-- Full Topic Content -->
            <div v-else class="topic-content">
              <!-- Topic Progress -->
              <div class="topic-progress-bar">
                <div class="progress-info">
                  <span class="progress-label">{{ topic.name }} Progress</span>
                  <span class="progress-numbers">{{ getTopicStats(topic.id).solved }}/{{ getTopicStats(topic.id).total }} solved ({{ getTopicPercent(topic.id) }}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: getTopicPercent(topic.id) + '%' }"></div>
                </div>
                <div class="status-badges">
                  <Tag :value="getTopicStats(topic.id).solved + ' Solved'" severity="success" size="small" />
                  <Tag :value="getTopicStats(topic.id).attempted + ' Attempted'" severity="warn" size="small" />
                  <Tag :value="getTopicStats(topic.id).needsReview + ' Review'" severity="info" size="small" />
                  <Tag :value="getTopicStats(topic.id).notStarted + ' Not Started'" severity="secondary" size="small" />
                </div>
              </div>

              <!-- Patterns Summary -->
              <div v-if="topic.patternsSummary && topic.patternsSummary.length" class="patterns-summary">
                <h3><i class="pi pi-map"></i> Key Patterns</h3>
                <div class="patterns-list">
                  <span v-for="pattern in topic.patternsSummary" :key="pattern" class="pattern-tag">{{ pattern }}</span>
                </div>
              </div>

              <!-- Interview Problems -->
              <div v-if="topic.interviewPhases.length" class="problems-section">
                <h3><i class="pi pi-briefcase"></i> Interview Problems ({{ topic.interviewPhases.reduce((sum, p) => sum + p.problems.length, 0) }})</h3>
                <PhaseAccordion :phases="topic.interviewPhases" />
              </div>

              <!-- CP Problems -->
              <div v-if="topic.cpPhases.length" class="problems-section">
                <h3><i class="pi pi-code"></i> Competitive Programming Problems ({{ topic.cpPhases.reduce((sum, p) => sum + p.problems.length, 0) }})</h3>
                <PhaseAccordion :phases="topic.cpPhases" />
              </div>

              <!-- Resources -->
              <div v-if="topic.resources.length" class="resources-section">
                <h3><i class="pi pi-book"></i> Resources & Study Guide</h3>
                <ResourceSection
                  :resources="topic.resources"
                  :interviewTimeline="topic.interviewTimeline"
                  :cpTimeline="topic.cpTimeline"
                  :studyApproach="topic.studyApproach"
                />
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.sub-heading {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem 0;
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.tabs-section {
  margin-top: 1rem;
  scroll-margin-top: 1rem;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  gap: 0.5rem;
}

.placeholder-content h3 {
  margin: 0;
  font-size: 1.2rem;
}

.placeholder-content p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.placeholder-note {
  font-style: italic;
  font-size: 0.85rem !important;
}

.topic-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 0.5rem;
}

.topic-progress-bar {
  background: white;
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.progress-numbers {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.progress-track {
  width: 100%;
  height: 10px;
  background: var(--p-surface-200);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 5px;
  transition: width 0.5s ease;
}

.status-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.patterns-summary {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.patterns-summary h3 {
  font-size: 1rem;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.patterns-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pattern-tag {
  font-size: 0.8rem;
  padding: 0.3rem 0.65rem;
  background: white;
  border: 1px solid var(--p-surface-200);
  border-radius: 6px;
  color: var(--p-text-muted-color);
}

.problems-section h3,
.resources-section h3 {
  font-size: 1.05rem;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.problems-section h3 i {
  color: var(--p-primary-color);
}

.resources-section h3 i {
  color: var(--p-primary-color);
}

@media (max-width: 768px) {
  .topics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
