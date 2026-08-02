<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { concepts } from '@/data/concepts'
import type { ConceptCategory } from '@/data/concepts/types'

const categoryOrder: ConceptCategory[] = [
  'Start Here',
  'Core Infrastructure',
  'Data & Storage',
  'Caching & Performance',
  'Communication & Messaging',
  'Distributed Systems',
  'Patterns & Architecture',
  'Architecture Decisions',
  'Security & Auth',
  'Performance & Operations',
  'Other Essentials',
  'Reference',
]

const grouped = computed(() =>
  categoryOrder
    .map((category) => ({
      category,
      items: concepts.filter((c) => c.category === category).sort((a, b) => a.number - b.number),
    }))
    .filter((g) => g.items.length > 0),
)
</script>

<template>
  <div class="concepts-page">
    <p class="breadcrumb">Home <i class="pi pi-angle-right"></i> System Design Fundamentals</p>
    <h1><i class="pi pi-book"></i> System Design Fundamentals</h1>
    <p class="intro">
      The building blocks every design uses - {{ concepts.length }} concepts spanning infrastructure, data,
      caching, messaging, distributed systems, and architecture patterns. Each links to a focused deep dive
      with diagrams, comparison tables, and interview call-outs.
    </p>

    <div v-for="group in grouped" :key="group.category" class="category-group">
      <h2 class="category-title">{{ group.category }}</h2>
      <ol class="concept-list">
        <li v-for="c in group.items" :key="c.slug" class="concept-row">
          <RouterLink :to="`/concepts/${c.slug}`" class="concept-link">
            <span class="concept-number">{{ c.number }}</span>
            <i :class="c.icon" class="concept-icon"></i>
            <span class="concept-title">{{ c.title }}</span>
            <span class="concept-summary">{{ c.summary }}</span>
            <span class="concept-read">Read <i class="pi pi-arrow-right"></i></span>
          </RouterLink>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.concepts-page {
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breadcrumb {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
}

h1 {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--sc-text);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.intro {
  color: var(--sc-text-muted);
  max-width: 75ch;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.category-group {
  margin-bottom: 1.75rem;
}

.category-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--sc-accent-2);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.6rem;
}

.concept-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.concept-link {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  text-decoration: none;
  color: var(--sc-text);
}

.concept-link:hover {
  border-color: var(--sc-accent-2);
}

.concept-number {
  min-width: 1.5rem;
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.concept-icon {
  color: var(--sc-accent-2);
}

.concept-title {
  font-weight: 600;
  min-width: 220px;
}

.concept-summary {
  color: var(--sc-text-muted);
  font-size: 0.88rem;
  flex: 1;
}

.concept-read {
  color: var(--sc-accent-2);
  font-size: 0.85rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

@media (max-width: 700px) {
  .concept-link {
    flex-wrap: wrap;
  }
  .concept-summary {
    width: 100%;
    margin-left: 2.3rem;
  }
}
</style>
