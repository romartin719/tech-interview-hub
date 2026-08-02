<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { lldProblems } from '@/data/lld'
import MermaidDiagram from '@/components/hld/MermaidDiagram.vue'
import CodeBlock from '@/components/shared/CodeBlock.vue'

const route = useRoute()

const problem = computed(() => lldProblems.find((p) => p.slug === route.params.slug))

const difficultyClass = computed(() => {
  switch (problem.value?.difficulty) {
    case 'Beginner':
      return 'difficulty-beginner'
    case 'Intermediate':
      return 'difficulty-intermediate'
    case 'Advanced':
      return 'difficulty-advanced'
    default:
      return ''
  }
})

const relatedProblems = computed(() => {
  const slugs = problem.value?.relatedDesigns ?? []
  return slugs.map((slug) => lldProblems.find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => Boolean(p))
})

const tocSections = computed(() => {
  const sections = [
    { id: 'requirements', label: 'Requirements' },
    { id: 'core-entities', label: 'Core Entities' },
    { id: 'class-diagram', label: 'Class Diagram' },
    { id: 'design-patterns', label: 'Design Patterns' },
    { id: 'data-structures', label: 'Data Structures' },
    { id: 'how-it-fits-together', label: 'How It All Fits Together' },
    { id: 'complete-code', label: 'Complete Code' },
  ]
  if (problem.value?.stateDiagram) {
    sections.push({ id: 'state-diagram', label: 'State Diagram' })
  }
  sections.push(
    { id: 'sequence-diagram', label: problem.value?.sequenceDiagram.title || 'Sequence Diagram' },
    { id: 'how-to-extend', label: 'How to Extend' },
    { id: 'interviewer-checklist', label: 'What Interviewers Look For' },
    { id: 'key-takeaways', label: 'Key Takeaways' },
  )
  if (relatedProblems.value.length) {
    sections.push({ id: 'related-designs', label: 'Related Designs' })
  }
  return sections
})
</script>

<template>
  <div v-if="problem" class="lld-detail">
    <RouterLink to="/lld" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to Low Level Design
    </RouterLink>

    <p class="breadcrumb">Home <i class="pi pi-angle-right"></i> LLD <i class="pi pi-angle-right"></i> {{ problem.title }}</p>

    <div class="lld-detail-layout">
    <div class="lld-detail-main">
    <header class="detail-header">
      <div class="header-icon-chip" :style="{ background: problem.color }">
        <i :class="problem.icon"></i>
      </div>
      <div class="header-text">
        <div class="header-title-row">
          <h1>{{ problem.title }}</h1>
          <span class="sc-tag difficulty-tag" :class="difficultyClass">{{ problem.difficulty }}</span>
        </div>
        <p class="header-meta"><i class="pi pi-clock"></i> {{ problem.readTimeMinutes }} min read</p>
        <p class="header-summary">{{ problem.summary }}</p>
        <div class="tag-row">
          <span v-for="p in problem.patterns" :key="p" class="sc-tag">{{ p }}</span>
        </div>
        <div class="company-row">
          <span class="company-label">Asked at:</span>
          <span v-for="c in problem.companies" :key="c" class="company-name">{{ c }}</span>
        </div>
        <RouterLink :to="`/lld/${problem.slug}/practice`" class="sc-btn-primary practice-cta">
          <i class="pi pi-code"></i>
          Practice in IDE
        </RouterLink>
      </div>
    </header>

    <section id="requirements" class="detail-section">
      <h2><span class="section-number">1</span> Requirements</h2>
      <div class="requirements-grid">
        <div>
          <h3 class="subheading">Functional</h3>
          <ul class="bullet-list">
            <li v-for="r in problem.functionalRequirements" :key="r">{{ r }}</li>
          </ul>
        </div>
        <div>
          <h3 class="subheading">Non-Functional</h3>
          <ul class="bullet-list">
            <li v-for="r in problem.nonFunctionalRequirements" :key="r">{{ r }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section id="core-entities" class="detail-section">
      <h2><span class="section-number">2</span> Core Entities</h2>
      <table class="sc-table">
        <thead><tr><th>Entity</th><th>Description</th></tr></thead>
        <tbody>
          <tr v-for="e in problem.coreEntities" :key="e.name">
            <td><strong>{{ e.name }}</strong></td>
            <td>{{ e.description }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="class-diagram" class="detail-section">
      <h2><span class="section-number">3</span> Class Diagram</h2>
      <MermaidDiagram :title="problem.classDiagram.title" :definition="problem.classDiagram.mermaid" />
    </section>

    <section id="design-patterns" class="detail-section">
      <h2><span class="section-number">4</span> Design Patterns</h2>
      <table class="sc-table">
        <thead><tr><th>Pattern</th><th>Where</th><th>Why</th></tr></thead>
        <tbody>
          <tr v-for="d in problem.designPatterns" :key="d.pattern + d.where">
            <td><strong>{{ d.pattern }}</strong></td>
            <td>{{ d.where }}</td>
            <td>{{ d.why }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="data-structures" class="detail-section">
      <h2><span class="section-number">5</span> Data Structures</h2>
      <table class="sc-table">
        <thead><tr><th>Component</th><th>Structure</th><th>Why</th></tr></thead>
        <tbody>
          <tr v-for="d in problem.dataStructures" :key="d.component">
            <td><strong>{{ d.component }}</strong></td>
            <td>{{ d.structure }}</td>
            <td>{{ d.why }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="how-it-fits-together" class="detail-section">
      <h2><span class="section-number">6</span> How It All Fits Together</h2>
      <div v-for="w in problem.walkthroughs" :key="w.title" class="walkthrough-block">
        <h3 class="subheading">{{ w.title }}</h3>
        <ol class="numbered-steps">
          <li v-for="(s, i) in w.steps" :key="i">{{ s }}</li>
        </ol>
      </div>
    </section>

    <section id="complete-code" class="detail-section">
      <h2><span class="section-number">7</span> Complete Code</h2>
      <div v-for="f in problem.codeFiles" :key="f.filename" class="code-file-block">
        <h3 class="code-filename">{{ f.filename }}</h3>
        <p class="section-body">{{ f.rationale }}</p>
        <div v-if="f.callout" class="callout-box">
          <p class="callout-title">{{ f.calloutTitle }}</p>
          <p>{{ f.callout }}</p>
        </div>
        <CodeBlock :filename="f.filename" :code="f.code" />
      </div>
    </section>

    <section v-if="problem.stateDiagram" id="state-diagram" class="detail-section">
      <h2><span class="section-number">8</span> State Diagram</h2>
      <MermaidDiagram :title="problem.stateDiagram.title" :definition="problem.stateDiagram.mermaid" />
    </section>

    <section id="sequence-diagram" class="detail-section">
      <h2><span class="section-number">{{ problem.stateDiagram ? 9 : 8 }}</span> {{ problem.sequenceDiagram.title || 'Sequence Diagram' }}</h2>
      <MermaidDiagram :definition="problem.sequenceDiagram.mermaid" />
    </section>

    <section id="how-to-extend" class="detail-section">
      <h2><span class="section-number">{{ problem.stateDiagram ? 10 : 9 }}</span> How to Extend</h2>
      <table class="sc-table">
        <thead><tr><th>Extension</th><th>Implementation</th></tr></thead>
        <tbody>
          <tr v-for="e in problem.extensions" :key="e.extension">
            <td><strong>{{ e.extension }}</strong></td>
            <td>{{ e.implementation }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="interviewer-checklist" class="detail-section">
      <h2><span class="section-number">{{ problem.stateDiagram ? 11 : 10 }}</span> What Interviewers Look For</h2>
      <ul class="checklist">
        <li v-for="c in problem.interviewerChecklist" :key="c"><i class="pi pi-check-circle"></i> {{ c }}</li>
      </ul>
    </section>

    <section id="key-takeaways" class="detail-section">
      <h2><span class="section-number">{{ problem.stateDiagram ? 12 : 11 }}</span> Key Takeaways</h2>
      <ul class="bullet-list">
        <li v-for="k in problem.keyTakeaways" :key="k">{{ k }}</li>
      </ul>
    </section>

    <section v-if="relatedProblems.length" id="related-designs" class="detail-section">
      <h2><span class="section-number">{{ problem.stateDiagram ? 13 : 12 }}</span> Related Designs</h2>
      <div class="related-grid">
        <RouterLink v-for="r in relatedProblems" :key="r.slug" :to="`/lld/${r.slug}`" class="related-card">
          <i :class="r.icon" :style="{ color: r.color }"></i>
          <span>{{ r.title }}</span>
        </RouterLink>
      </div>
    </section>
    </div>

    <aside class="lld-toc">
      <div class="toc-card">
        <div class="toc-title">On this page</div>
        <a v-for="s in tocSections" :key="s.id" :href="`#${s.id}`" class="toc-link">{{ s.label }}</a>
      </div>
    </aside>
    </div>
  </div>
  <div v-else class="not-found">
    <p>Problem not found.</p>
    <RouterLink to="/lld">Back to Low Level Design</RouterLink>
  </div>
</template>

<style scoped>
.lld-detail {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding-bottom: 2rem;
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
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.lld-detail-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1200px) {
  .lld-detail-layout {
    grid-template-columns: 1fr 220px;
  }
}

.lld-detail-main {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-width: 0;
}

.lld-toc {
  display: none;
}

@media (min-width: 1200px) {
  .lld-toc {
    display: block;
  }
}

.toc-card {
  position: sticky;
  top: 1rem;
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toc-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sc-accent-2);
  margin-bottom: 0.25rem;
}

.toc-link {
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.82rem;
  line-height: 1.5;
}

.toc-link:hover {
  color: var(--sc-text);
}

.detail-header {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--sc-border);
}

.header-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  min-width: 3.25rem;
  border-radius: var(--sc-radius-md);
  color: #ffffff;
  font-size: 1.4rem;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.header-title-row h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--sc-text);
}

.difficulty-tag {
  font-weight: 600;
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

.header-meta {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  margin: 0.4rem 0 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.header-summary {
  color: var(--sc-text-muted);
  font-size: 0.98rem;
  margin: 0.4rem 0 0.75rem;
  line-height: 1.5;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.company-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.company-label {
  color: var(--sc-text-muted);
}

.company-name {
  color: var(--sc-accent-2);
  font-weight: 500;
}

.practice-cta {
  margin-top: 0.85rem;
  width: fit-content;
  text-decoration: none;
}

.detail-section h2 {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 1rem;
}

.section-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  min-width: 1.75rem;
  border-radius: 50%;
  background: var(--sc-gradient-primary);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
}

.section-body {
  color: var(--sc-text-muted);
  line-height: 1.7;
  font-size: 0.98rem;
  white-space: pre-line;
  margin-bottom: 0.75rem;
}

.subheading {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sc-text);
  margin: 1rem 0 0.5rem;
}

.bullet-list {
  padding-left: 1.25rem;
  color: var(--sc-text-muted);
  line-height: 1.7;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.requirements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.walkthrough-block {
  margin-bottom: 1.25rem;
}

.numbered-steps {
  padding-left: 1.5rem;
  color: var(--sc-text-muted);
  line-height: 1.8;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.code-file-block {
  margin-bottom: 2rem;
}

.code-filename {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 1rem;
  font-weight: 700;
  color: var(--sc-accent-2);
  margin-bottom: 0.5rem;
}

.callout-box {
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: var(--sc-radius-md);
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--sc-text-muted);
}

.callout-title {
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.25rem;
}

.checklist {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--sc-text-muted);
  font-size: 0.95rem;
}

.checklist i {
  color: #6ee7b7;
  margin-right: 0.4rem;
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
