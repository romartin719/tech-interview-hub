<script setup lang="ts">
import type { Resource, TimelineEntry } from '@/types/problems'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Tag from 'primevue/tag'

defineProps<{
  resources: Resource[]
  interviewTimeline: TimelineEntry[]
  cpTimeline: TimelineEntry[]
  studyApproach: { interview: string; cp: string }
}>()

function getResourcesByType(resources: Resource[], type: Resource['type']) {
  return resources.filter((r) => r.type === type)
}

function getCategorySeverity(cat: string): 'success' | 'warn' | 'info' {
  if (cat === 'interview') return 'success'
  if (cat === 'cp') return 'warn'
  return 'info'
}
</script>

<template>
  <div class="resource-section">
    <Accordion multiple>
      <AccordionPanel value="videos" v-if="getResourcesByType(resources, 'video').length">
        <AccordionHeader>
          <span><i class="pi pi-video"></i> Video Resources</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="resource-list">
            <div v-for="r in getResourcesByType(resources, 'video')" :key="r.name" class="resource-item">
              <div class="resource-info">
                <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="resource-link"><strong>{{ r.name }}</strong></a>
                <strong v-else>{{ r.name }}</strong>
                <Tag :value="r.category" :severity="getCategorySeverity(r.category)" size="small" />
              </div>
              <p>{{ r.description }}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="written" v-if="getResourcesByType(resources, 'written').length || getResourcesByType(resources, 'platform').length">
        <AccordionHeader>
          <span><i class="pi pi-file"></i> Written Resources & Platforms</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="resource-list">
            <div v-for="r in [...getResourcesByType(resources, 'written'), ...getResourcesByType(resources, 'platform')]" :key="r.name" class="resource-item">
              <div class="resource-info">
                <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="resource-link"><strong>{{ r.name }}</strong></a>
                <strong v-else>{{ r.name }}</strong>
                <Tag :value="r.category" :severity="getCategorySeverity(r.category)" size="small" />
              </div>
              <p>{{ r.description }}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="books" v-if="getResourcesByType(resources, 'book').length">
        <AccordionHeader>
          <span><i class="pi pi-book"></i> Books</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="resource-list">
            <div v-for="r in getResourcesByType(resources, 'book')" :key="r.name" class="resource-item">
              <div class="resource-info">
                <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="resource-link"><strong>{{ r.name }}</strong></a>
                <strong v-else>{{ r.name }}</strong>
                <Tag :value="r.category" :severity="getCategorySeverity(r.category)" size="small" />
              </div>
              <p>{{ r.description }}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="interview-timeline" v-if="interviewTimeline.length">
        <AccordionHeader>
          <span><i class="pi pi-calendar"></i> Interview Prep Timeline</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="timeline">
            <div v-for="(entry, idx) in interviewTimeline" :key="idx" class="timeline-entry">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <strong>{{ entry.title }}</strong>
                <p>{{ entry.description }}</p>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="cp-timeline" v-if="cpTimeline.length">
        <AccordionHeader>
          <span><i class="pi pi-calendar"></i> CP Learning Timeline</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="timeline">
            <div v-for="(entry, idx) in cpTimeline" :key="idx" class="timeline-entry">
              <div class="timeline-dot cp"></div>
              <div class="timeline-content">
                <strong>{{ entry.title }}</strong>
                <p>{{ entry.description }}</p>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="study-approach" v-if="studyApproach.interview || studyApproach.cp">
        <AccordionHeader>
          <span><i class="pi pi-lightbulb"></i> Study Approach</span>
        </AccordionHeader>
        <AccordionContent>
          <div v-if="studyApproach.interview" class="approach-block">
            <h4>For Interviews</h4>
            <p>{{ studyApproach.interview }}</p>
          </div>
          <div v-if="studyApproach.cp" class="approach-block">
            <h4>For Competitive Programming</h4>
            <p>{{ studyApproach.cp }}</p>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>

<style scoped>
.resource-section {
  margin-top: 1.5rem;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.resource-item {
  padding: 0.75rem;
  background: var(--p-surface-50);
  border-radius: 8px;
  border-left: 3px solid var(--p-primary-color);
}

.resource-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.resource-info strong {
  font-size: 0.9rem;
}

.resource-link {
  text-decoration: none;
  color: inherit;
}

.resource-link:hover strong {
  color: var(--p-primary-color);
  text-decoration: underline;
}

.resource-item p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 0.5rem;
}

.timeline-entry {
  display: flex;
  gap: 1rem;
  padding-bottom: 1rem;
  position: relative;
}

.timeline-entry:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: var(--p-surface-200);
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--p-primary-color);
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-dot.cp {
  background: #f59e0b;
}

.timeline-content strong {
  font-size: 0.9rem;
  display: block;
  margin-bottom: 0.25rem;
}

.timeline-content p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.approach-block {
  margin-bottom: 1rem;
}

.approach-block h4 {
  font-size: 0.95rem;
  margin: 0 0 0.5rem 0;
  color: var(--p-primary-color);
}

.approach-block p {
  font-size: 0.85rem;
  line-height: 1.6;
  margin: 0;
  color: var(--p-text-muted-color);
}
</style>
