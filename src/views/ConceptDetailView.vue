<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { concepts } from '@/data/concepts'
import MermaidDiagram from '@/components/hld/MermaidDiagram.vue'

const route = useRoute()

const concept = computed(() => concepts.find((c) => c.slug === route.params.slug))

const relatedConceptObjs = computed(() => {
  const slugs = concept.value?.relatedConcepts ?? []
  return slugs.map((slug) => concepts.find((c) => c.slug === slug)).filter((c): c is NonNullable<typeof c> => Boolean(c))
})

function calloutIcon(kind: string): string {
  if (kind === 'warning') return 'pi pi-exclamation-triangle'
  if (kind === 'mistake') return 'pi pi-times-circle'
  return 'pi pi-lightbulb'
}
</script>

<template>
  <div v-if="concept" class="concept-detail">
    <RouterLink to="/concepts" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to System Design Fundamentals
    </RouterLink>

    <p class="breadcrumb">Home <i class="pi pi-angle-right"></i> Concepts <i class="pi pi-angle-right"></i> {{ concept.title }}</p>

    <header class="detail-header">
      <div class="header-icon-chip"><i :class="concept.icon"></i></div>
      <div>
        <h1>{{ concept.title }}</h1>
        <p class="header-meta"><i class="pi pi-clock"></i> {{ concept.readTimeMinutes }} min read · {{ concept.category }}</p>
        <p class="header-summary">{{ concept.summary }}</p>
      </div>
    </header>

    <div class="blocks">
      <template v-for="(block, i) in concept.blocks" :key="i">
        <p v-if="block.type === 'paragraph'" class="block-paragraph">{{ block.text }}</p>

        <h2 v-else-if="block.type === 'heading'" class="block-heading">{{ block.text }}</h2>

        <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'" class="block-list">
          <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
        </component>

        <div v-else-if="block.type === 'table'" class="block-table-wrap">
          <p v-if="block.caption" class="table-caption">{{ block.caption }}</p>
          <table class="sc-table">
            <thead>
              <tr><th v-for="h in block.headers" :key="h">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, r) in block.rows" :key="r">
                <td v-for="(cell, c) in row" :key="c">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="block.type === 'code'" class="block-code-wrap">
          <p v-if="block.caption" class="code-caption">{{ block.caption }}</p>
          <pre class="sc-code-block">{{ block.code }}</pre>
        </div>

        <div v-else-if="block.type === 'diagram'" class="block-diagram-wrap">
          <MermaidDiagram :title="block.diagram.title" :definition="block.diagram.mermaid" />
        </div>

        <div v-else-if="block.type === 'callout'" class="callout-box" :class="`callout-${block.kind}`">
          <p class="callout-title"><i :class="calloutIcon(block.kind)"></i> {{ block.title || (block.kind === 'warning' ? 'Common Mistake' : 'Interview Tip') }}</p>
          <p>{{ block.text }}</p>
        </div>

        <div v-else-if="block.type === 'usedIn'" class="used-in-row">
          <span class="used-in-label">Used in:</span>
          <span v-for="item in block.items" :key="item" class="used-in-chip">{{ item }}</span>
        </div>
      </template>
    </div>

    <section v-if="relatedConceptObjs.length" class="related-section">
      <h2 class="block-heading">Related Concepts</h2>
      <div class="related-grid">
        <RouterLink v-for="r in relatedConceptObjs" :key="r.slug" :to="`/concepts/${r.slug}`" class="related-card">
          <i :class="r.icon"></i>
          <span>{{ r.title }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
  <div v-else class="not-found">
    <p>Concept not found.</p>
    <RouterLink to="/concepts">Back to System Design Fundamentals</RouterLink>
  </div>
</template>

<style scoped>
.concept-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
  max-width: 900px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  width: fit-content;
}

.back-link:hover {
  color: var(--sc-text);
}

.breadcrumb {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
}

.detail-header {
  display: flex;
  gap: 1.1rem;
  align-items: flex-start;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--sc-border);
}

.header-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  min-width: 3rem;
  border-radius: var(--sc-radius-md);
  background: var(--sc-gradient-primary);
  color: #fff;
  font-size: 1.3rem;
}

.detail-header h1 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--sc-text);
  margin-bottom: 0.3rem;
}

.header-meta {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.header-summary {
  color: var(--sc-text-muted);
  line-height: 1.5;
}

.blocks {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.block-paragraph {
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: 0.98rem;
}

.block-heading {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-top: 0.5rem;
}

.block-list {
  padding-left: 1.4rem;
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.table-caption,
.code-caption {
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.callout-box {
  border-radius: var(--sc-radius-md);
  padding: 0.85rem 1.1rem;
  font-size: 0.92rem;
  line-height: 1.6;
}

.callout-tip {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--sc-text-muted);
}

.callout-warning,
.callout-mistake {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--sc-text-muted);
}

.callout-title {
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.used-in-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
}

.used-in-label {
  color: var(--sc-text-muted);
}

.used-in-chip {
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  color: var(--sc-accent-2);
}

.related-section {
  margin-top: 1rem;
}

.related-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.related-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: var(--sc-text);
  font-size: 0.9rem;
}

.related-card:hover {
  border-color: var(--sc-accent-2);
}

.not-found {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  padding: 4rem 0;
}
</style>
