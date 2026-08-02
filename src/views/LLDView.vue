<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { lldProblems } from '@/data/lld'
import { useLldProgressStore } from '@/stores/useLldProgressStore'

const router = useRouter()
const progressStore = useLldProgressStore()

onMounted(() => {
  progressStore.load()
})

const PRACTICE_LANGUAGES = ['Java', 'Python', 'C++', 'JS']

const solidPrinciples = [
  {
    letter: 'S',
    name: 'Single Responsibility',
    description: 'A class should have one, and only one, reason to change.',
    example: 'Separate UserValidator from UserRepository instead of one God class.',
  },
  {
    letter: 'O',
    name: 'Open/Closed',
    description: 'Open for extension, closed for modification.',
    example: 'Use Strategy pattern to add new payment methods without changing PaymentProcessor.',
  },
  {
    letter: 'L',
    name: 'Liskov Substitution',
    description: 'Subtypes must be substitutable for their base types.',
    example: 'Square should not extend Rectangle if setWidth/setHeight behave differently.',
  },
  {
    letter: 'I',
    name: 'Interface Segregation',
    description: 'No client should be forced to depend on methods it does not use.',
    example: 'Split IWorker into IWorkable and IFeedable — robots don\'t eat.',
  },
  {
    letter: 'D',
    name: 'Dependency Inversion',
    description: 'Depend on abstractions, not concretions.',
    example: 'NotificationService depends on IMessageSender, not directly on EmailSender.',
  },
]

const designPatternGroups = [
  {
    category: 'Creational',
    patterns: [
      { name: 'Singleton', use: 'Database connections, Logger, Config manager' },
      { name: 'Factory Method', use: 'Create objects without specifying exact class' },
      { name: 'Abstract Factory', use: 'Create families of related objects (UI themes)' },
      { name: 'Builder', use: 'Step-by-step construction of complex objects (Query builder)' },
      { name: 'Prototype', use: 'Clone existing objects (spreadsheet cell copy)' },
    ],
  },
  {
    category: 'Structural',
    patterns: [
      { name: 'Adapter', use: 'Make incompatible interfaces work together' },
      { name: 'Decorator', use: 'Add behavior dynamically (I/O streams, middleware)' },
      { name: 'Facade', use: 'Simplified interface to a complex subsystem' },
      { name: 'Proxy', use: 'Lazy loading, access control, logging' },
      { name: 'Composite', use: 'Tree structures (file system, UI components)' },
    ],
  },
  {
    category: 'Behavioral',
    patterns: [
      { name: 'Strategy', use: 'Interchangeable algorithms (sorting, compression)' },
      { name: 'Observer', use: 'Event systems, pub/sub, reactive updates' },
      { name: 'Command', use: 'Undo/redo, task queues, macro recording' },
      { name: 'State', use: 'Finite state machines (order status, player states)' },
      { name: 'Chain of Responsibility', use: 'Middleware, validation chains, event bubbling' },
    ],
  },
]

const gradingCriteria = [
  { title: 'Working Demo', detail: 'Must compile and run end-to-end with a main/demo class.' },
  { title: 'Separation of Concerns', detail: 'Multiple files/classes, each doing one thing well.' },
  { title: 'Strategy Pattern', detail: 'At least one strategy — pricing, eviction, assignment, scoring.' },
  { title: 'Extensibility', detail: 'Adding a new variant = one new class, no edits to existing code.' },
  { title: 'Edge Cases', detail: 'Null inputs, capacity limits, state machine violations.' },
  { title: 'Thread-Safety', detail: 'When shared mutable state exists, synchronize correctly.' },
]

const DIFFICULTIES: Array<'Beginner' | 'Intermediate' | 'Advanced'> = ['Beginner', 'Intermediate', 'Advanced']
const DIFFICULTY_DOT: Record<string, string> = {
  Beginner: 'dot-green',
  Intermediate: 'dot-yellow',
  Advanced: 'dot-red',
}
const FILTER_OPTIONS = ['All', ...DIFFICULTIES] as const
type Filter = (typeof FILTER_OPTIONS)[number]

const activeFilter = ref<Filter>('All')

const grouped = computed(() => {
  const filtered =
    activeFilter.value === 'All'
      ? lldProblems
      : lldProblems.filter((p) => p.difficulty === activeFilter.value)
  return DIFFICULTIES.map((d) => ({ difficulty: d, problems: filtered.filter((p) => p.difficulty === d) })).filter(
    (g) => g.problems.length,
  )
})

const uniquePatternCount = computed(() => new Set(lldProblems.flatMap((p) => p.patterns)).size)

const progressPercent = computed(() =>
  lldProblems.length > 0 ? Math.round((progressStore.completedCount / lldProblems.length) * 100) : 0,
)

const dueProblems = computed(() =>
  lldProblems
    .filter((p) => progressStore.isDue(p.slug))
    .map((p) => ({ ...p, overdueDays: progressStore.daysOverdue(p.slug) }))
    .sort((a, b) => b.overdueDays - a.overdueDays),
)

function difficultyClass(difficulty: string): string {
  return `difficulty-${difficulty.toLowerCase()}`
}

function openPractice(slug: string) {
  router.push(`/lld/${slug}/practice`)
}
</script>

<template>
  <div class="lld-page">
    <header class="lld-hero">
      <p class="sc-badge-line">Machine Coding</p>
      <h1 class="lld-title">Low Level Design</h1>
      <p class="lld-subtitle">
        OOP problems with design patterns, runnable code, and company tags — built for
        PhonePe, Flipkart, Swiggy, Razorpay-style machine coding rounds.
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <strong>{{ lldProblems.length }}</strong>
          <span>Problems</span>
        </div>
        <div class="hero-stat">
          <strong>{{ uniquePatternCount }}+</strong>
          <span>Design Patterns</span>
        </div>
        <div class="hero-stat">
          <strong>90 min</strong>
          <span>Format</span>
        </div>
      </div>
    </header>

    <div class="progress-strip">
      <div class="progress-inner">
        <span class="progress-label">{{ progressStore.completedCount }}/{{ lldProblems.length }} completed</span>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
    </div>

    <div v-if="dueProblems.length" class="revision-box">
      <div class="revision-header">
        <span class="revision-icon">🔄</span>
        <strong>Time to revise</strong>
        <span class="revision-sub">These are due based on your spaced-repetition schedule</span>
      </div>
      <div class="revision-list">
        <div v-for="p in dueProblems" :key="p.slug" class="revision-item">
          <RouterLink :to="`/lld/${p.slug}`" class="revision-name">{{ p.title }}</RouterLink>
          <span class="revision-days">{{ p.overdueDays === 0 ? 'due today' : `${p.overdueDays}d overdue` }}</span>
          <button class="rev-btn rev-btn-done" @click="progressStore.markRevised(p.slug)">
            <i class="pi pi-check"></i> Done
          </button>
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
        <span class="diff-dot" :class="DIFFICULTY_DOT[g.difficulty]"></span>
        {{ g.difficulty }}
        <span class="group-count">{{ g.problems.length }} problems</span>
      </h2>
      <div class="cards-grid">
        <div v-for="prob in g.problems" :key="prob.slug" class="sc-card sc-card-hoverable problem-card">
          <div class="problem-card-top">
            <span class="sc-tag" :class="difficultyClass(prob.difficulty)">{{ prob.difficulty }}</span>
            <div class="problem-card-top-actions">
              <button class="ide-chip" title="Practice in the multi-file IDE" @click.stop="openPractice(prob.slug)">
                <span>&lt;/&gt;</span> Code
              </button>
              <label class="problem-checkbox" :title="progressStore.isCompleted(prob.slug) ? 'Mark as not completed' : 'Mark as completed'">
                <input
                  type="checkbox"
                  :checked="progressStore.isCompleted(prob.slug)"
                  @click.stop
                  @change="progressStore.toggleCompleted(prob.slug)"
                />
                <span class="checkbox-mark"></span>
              </label>
            </div>
          </div>

          <RouterLink :to="`/lld/${prob.slug}`" class="problem-card-link">
            <div class="card-title-row">
              <div class="card-icon-chip" :style="{ background: prob.color }">
                <i :class="prob.icon"></i>
              </div>
              <h3 class="card-title">{{ prob.title }}</h3>
            </div>
            <p class="card-summary">
              {{ prob.summary }}
              <span class="card-time">~{{ prob.readTimeMinutes }} min read</span>
            </p>
            <div class="card-tags">
              <span v-for="p in prob.patterns" :key="p" class="sc-tag">{{ p }}</span>
            </div>
          </RouterLink>

          <div class="card-meta">
            <div class="card-companies">
              <span v-for="c in prob.companies" :key="c" class="meta-chip">{{ c }}</span>
            </div>
            <div class="card-lang">
              <span v-for="l in PRACTICE_LANGUAGES" :key="l" class="meta-chip lang-chip">{{ l }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="sc-card content-card grading-card">
      <h2 class="content-card-title">What Interviewers Grade On</h2>
      <div class="grading-grid">
        <div v-for="(g, i) in gradingCriteria" :key="g.title" class="grade-item">
          <div class="grade-num">{{ i + 1 }}</div>
          <div class="grade-content">
            <strong>{{ g.title }}</strong>
            <span>{{ g.detail }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="sc-card content-card">
      <h2 class="content-card-title">SOLID Principles</h2>
      <div class="solid-grid">
        <div v-for="p in solidPrinciples" :key="p.letter" class="sc-card sc-card-hoverable solid-card">
          <div class="solid-card-title">
            <span class="solid-letter">{{ p.letter }}</span> {{ p.name }}
          </div>
          <p class="solid-desc"><strong>Principle:</strong> {{ p.description }}</p>
          <p class="solid-example"><i class="pi pi-code"></i> {{ p.example }}</p>
        </div>
      </div>
    </section>

    <section class="sc-card content-card">
      <h2 class="content-card-title">Design Patterns Reference</h2>
      <div class="pattern-categories">
        <div v-for="cat in designPatternGroups" :key="cat.category" class="pattern-category">
          <h3 class="pattern-category-title">{{ cat.category }} Patterns</h3>
          <div class="pattern-list">
            <div v-for="p in cat.patterns" :key="p.name" class="pattern-item">
              <span class="sc-tag pattern-name">{{ p.name }}</span>
              <span class="pattern-use">{{ p.use }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lld-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.lld-hero {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--sc-border);
}

.lld-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--sc-text);
}

.lld-subtitle {
  color: var(--sc-text-muted);
  font-size: 1rem;
  line-height: 1.6;
  max-width: 700px;
}

.hero-stats {
  display: flex;
  gap: 2rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.hero-stat strong {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--sc-text);
}

.hero-stat span {
  font-size: 0.78rem;
  color: var(--sc-text-muted);
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

.revision-box {
  background: var(--sc-surface);
  border: 1px solid var(--sc-accent-tag-border);
  border-radius: var(--sc-radius-md);
  padding: 1.1rem 1.4rem;
}

.revision-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.revision-icon {
  font-size: 1.1rem;
}

.revision-header strong {
  font-size: 0.9rem;
  color: var(--sc-text);
}

.revision-sub {
  font-size: 0.72rem;
  color: var(--sc-text-dim);
}

.revision-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.revision-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--sc-surface-2);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-sm);
  padding: 0.55rem 0.9rem;
  transition: border-color 0.2s ease;
}

.revision-item:hover {
  border-color: var(--sc-accent-tag-border);
}

.revision-name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--sc-text);
  text-decoration: none;
}

.revision-name:hover {
  color: var(--sc-accent-2);
}

.revision-days {
  font-size: 0.72rem;
  color: var(--sc-warning);
}

.rev-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 1px solid var(--sc-border-strong);
  color: var(--sc-text-muted);
  border-radius: var(--sc-radius-sm);
  padding: 0.3rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rev-btn-done:hover {
  border-color: var(--sc-success);
  color: var(--sc-success);
  background: rgba(52, 211, 153, 0.1);
}

.content-card {
  padding: 1.5rem;
}

.content-card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 1rem;
}

.grading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.grade-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.grade-num {
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

.grade-content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.grade-content strong {
  font-size: 0.92rem;
  color: var(--sc-text);
}

.grade-content span {
  font-size: 0.82rem;
  color: var(--sc-text-muted);
  line-height: 1.5;
}

.solid-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.solid-card {
  padding: 1.1rem;
}

.solid-card-title {
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.5rem;
}

.solid-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--sc-radius-sm);
  background: var(--sc-gradient-primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.95rem;
  margin-right: 0.6rem;
  flex-shrink: 0;
}

.solid-desc {
  color: var(--sc-text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
  margin-bottom: 0.5rem;
}

.solid-example {
  padding: 0.5rem 0.65rem;
  background: var(--sc-surface-2);
  border-radius: var(--sc-radius-xs);
  font-size: 0.82rem;
  color: var(--sc-text-muted);
}

.pattern-categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.pattern-category-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sc-accent-2);
  margin-bottom: 0.75rem;
}

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.pattern-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--sc-border);
}

.pattern-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.pattern-name {
  width: fit-content;
}

.pattern-use {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
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

.diff-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.diff-dot.dot-green {
  background: var(--sc-success);
}

.diff-dot.dot-yellow {
  background: var(--sc-warning);
}

.diff-dot.dot-red {
  background: var(--sc-danger);
}

.group-count {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--sc-text-muted);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.problem-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1.5rem;
}

.problem-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  position: relative;
  z-index: 2;
}

.problem-card-top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ide-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(251, 146, 60, 0.08);
  color: #fb923c;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(251, 146, 60, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ide-chip:hover {
  background: #fb923c;
  color: #0d0d12;
}

.card-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  border-radius: var(--sc-radius-sm);
  color: #ffffff;
  font-size: 0.95rem;
}

.problem-checkbox {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.problem-checkbox input {
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
  transition: background 0.15s ease, border-color 0.15s ease;
}

.problem-checkbox input:checked + .checkbox-mark {
  background: var(--sc-accent);
  border-color: var(--sc-accent);
}

.problem-checkbox input:checked + .checkbox-mark::after {
  content: '\2713';
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
}

.problem-card-link {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-decoration: none;
}

.problem-card-link::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
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
}

.card-time {
  display: inline-block;
  margin-left: 0.35rem;
  color: var(--sc-text-dim);
  font-size: 0.78rem;
  white-space: nowrap;
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

.card-meta {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--sc-border);
}

.card-companies,
.card-lang {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.meta-chip {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--sc-text-dim);
  background: var(--sc-surface-2);
  border-radius: var(--sc-radius-xs);
  padding: 0.15rem 0.45rem;
}

.lang-chip {
  color: var(--sc-accent-2);
}
</style>
