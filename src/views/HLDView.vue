<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { hldTopics as newTopics } from '@/data/hld'
import { hldTopics as legacyTopicsRaw } from '@/data/hldTopics'
import { useHldProgressStore } from '@/stores/useHldProgressStore'

interface CardTopic {
  slug: string
  title: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  icon: string
  color: string
  summary: string
  tags: string[]
  hasSimulator: boolean
}

const router = useRouter()
const progressStore = useHldProgressStore()

onMounted(() => {
  progressStore.load()
})

const allTopics = computed<CardTopic[]>(() => {
  const newSlugs = new Set(newTopics.map((t) => t.slug))
  const migrated = newTopics.map((t) => ({
    slug: t.slug,
    title: t.title,
    difficulty: t.difficulty,
    icon: t.icon,
    color: t.color,
    summary: t.summary,
    tags: t.topics,
    hasSimulator: Boolean(t.simulator),
  }))
  const legacy = legacyTopicsRaw
    .filter((t) => !newSlugs.has(t.slug))
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      difficulty: t.difficulty,
      icon: t.icon,
      color: t.color,
      summary: t.summary,
      tags: t.concepts,
      hasSimulator: Boolean(t.simulator),
    }))
  return [...migrated, ...legacy]
})

const DIFFICULTIES: Array<'Beginner' | 'Intermediate' | 'Advanced'> = ['Beginner', 'Intermediate', 'Advanced']
const FILTER_OPTIONS = ['All', ...DIFFICULTIES] as const
type Filter = (typeof FILTER_OPTIONS)[number]

const activeFilter = ref<Filter>('All')

const grouped = computed(() => {
  const filtered =
    activeFilter.value === 'All'
      ? allTopics.value
      : allTopics.value.filter((t) => t.difficulty === activeFilter.value)
  return DIFFICULTIES.map((d) => ({ difficulty: d, topics: filtered.filter((t) => t.difficulty === d) })).filter(
    (g) => g.topics.length,
  )
})

const progressPercent = computed(() =>
  allTopics.value.length > 0 ? Math.round((progressStore.completedCount / allTopics.value.length) * 100) : 0,
)

function openSimulate(slug: string) {
  router.push(`/hld/${slug}/simulate`)
}

function openDraw(slug: string) {
  router.push(`/draw?d=${slug}`)
}
</script>

<template>
  <div class="hld-page">
    <header class="hld-hero">
      <p class="sc-badge-line">System design for large-scale distributed systems</p>
      <h1 class="hld-title">High Level Design</h1>
      <p class="hld-subtitle">
        Distributed architectures with diagrams, technology trade-offs, and deep dives — from
        rate limiters and URL shorteners to ride-sharing and video streaming platforms.
      </p>
      <p class="hld-total">{{ allTopics.length }} designs across 3 difficulty levels</p>
    </header>

    <div class="progress-strip">
      <div class="progress-inner">
        <span class="progress-label">{{ progressStore.completedCount }}/{{ allTopics.length }} completed</span>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="filter-tabs">
      <button
        v-for="f in FILTER_OPTIONS"
        :key="f"
        class="filter-tab"
        :class="{ active: activeFilter === f }"
        @click="activeFilter = f"
      >
        {{ f }}
      </button>
    </div>

    <section v-for="g in grouped" :key="g.difficulty" class="difficulty-group">
      <h2 class="group-heading">
        {{ g.difficulty }}
        <span class="group-count">{{ g.topics.length }}</span>
      </h2>
      <div class="cards-grid">
        <div v-for="topic in g.topics" :key="topic.slug" class="sc-card sc-card-hoverable topic-card">
          <div class="card-top">
            <span class="sc-tag" :class="`difficulty-${topic.difficulty.toLowerCase()}`">{{
              topic.difficulty
            }}</span>
            <div class="card-top-actions">
              <button
                v-if="topic.hasSimulator"
                type="button"
                class="action-chip sim-chip"
                title="Build and stress-test this design in the simulator"
                @click.stop="openSimulate(topic.slug)"
              >
                <i class="pi pi-play"></i> Simulate
              </button>
              <button
                type="button"
                class="action-chip draw-chip"
                title="Practice this design on the whiteboard"
                @click.stop="openDraw(topic.slug)"
              >
                <i class="pi pi-pencil"></i> Draw
              </button>
              <label
                class="topic-checkbox"
                :title="progressStore.isCompleted(topic.slug) ? 'Mark as not completed' : 'Mark as completed'"
              >
                <input
                  type="checkbox"
                  :checked="progressStore.isCompleted(topic.slug)"
                  @click.stop
                  @change="progressStore.toggleCompleted(topic.slug)"
                />
                <span class="checkbox-mark"></span>
              </label>
            </div>
          </div>

          <RouterLink :to="`/hld/${topic.slug}`" class="card-link">
            <div class="card-icon-chip" :style="{ background: topic.color }">
              <i :class="topic.icon"></i>
            </div>
            <h3 class="card-title">{{ topic.title }}</h3>
            <p class="card-summary">{{ topic.summary }}</p>
            <div class="card-tags">
              <span v-for="c in topic.tags.slice(0, 3)" :key="c" class="sc-tag">{{ c }}</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hld-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hld-hero {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--sc-border);
}

.hld-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--sc-text);
}

.hld-subtitle {
  color: var(--sc-text-muted);
  font-size: 1rem;
  line-height: 1.6;
  max-width: 700px;
}

.hld-total {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.progress-strip {
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  padding: 1rem 1.25rem;
}

.progress-inner {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--sc-text);
}

.progress-bar-track {
  height: 8px;
  border-radius: var(--sc-radius-full);
  background: var(--sc-surface-2);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--sc-gradient-primary);
  border-radius: var(--sc-radius-full);
  transition: width 0.3s ease;
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-tab {
  font-family: var(--sc-font);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.5rem 1.1rem;
  border-radius: var(--sc-radius-sm);
  border: 1px solid var(--sc-border);
  background: transparent;
  color: var(--sc-text-muted);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.filter-tab:hover {
  border-color: var(--sc-accent-tag-border);
  color: var(--sc-text);
}

.filter-tab.active {
  background: var(--sc-accent-tag-bg);
  border-color: var(--sc-accent-tag-border);
  color: var(--sc-accent-tag-text);
}

.difficulty-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.group-heading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--sc-text);
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--sc-accent-tag-bg);
  border: 1px solid var(--sc-accent-tag-border);
  color: var(--sc-accent-tag-text);
  font-size: 0.75rem;
  font-weight: 700;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.topic-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.5rem;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}

.topic-card:hover {
  border-color: var(--sc-accent-tag-border);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  position: relative;
  z-index: 2;
}

.card-top-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--sc-font);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sim-chip {
  background: var(--sc-accent-tag-bg);
  border: 1px solid var(--sc-accent-tag-border);
  color: var(--sc-accent-tag-text);
}

.sim-chip:hover {
  background: var(--sc-accent);
  color: #ffffff;
}

.draw-chip {
  background: rgba(251, 146, 60, 0.08);
  border: 1px solid rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.draw-chip:hover {
  background: #fb923c;
  color: #0d0d12;
}

.topic-checkbox {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.topic-checkbox input {
  position: absolute;
  opacity: 0;
  width: 1.4rem;
  height: 1.4rem;
  margin: 0;
  cursor: pointer;
}

.checkbox-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--sc-radius-xs);
  border: 1px solid var(--sc-border-strong);
  background: var(--sc-surface-2);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.topic-checkbox input:checked + .checkbox-mark {
  background: var(--sc-accent);
  border-color: var(--sc-accent);
}

.topic-checkbox input:checked + .checkbox-mark::after {
  content: '\2713';
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
}

.card-link {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-decoration: none;
}

.card-link::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.card-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--sc-radius-sm);
  color: #ffffff;
  font-size: 1.1rem;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--sc-text);
}

.card-summary {
  color: var(--sc-text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
  flex: 1;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.difficulty-beginner {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

.difficulty-intermediate {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #fcd34d;
}

.difficulty-advanced {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}
</style>
