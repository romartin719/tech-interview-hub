<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

const categories = [
  {
    name: 'JavaScript Core',
    topics: [
      'Closures, Scope, and Hoisting',
      'Prototypal Inheritance & the Prototype Chain',
      'Event Loop, Microtasks & Macrotasks',
      'Promises, async/await, and error handling',
      'this keyword, call/apply/bind',
      'ES6+ features (destructuring, spread, optional chaining, nullish coalescing)',
      'WeakMap, WeakSet, and garbage collection',
      'Generators and Iterators',
      'Proxy and Reflect',
    ],
  },
  {
    name: 'TypeScript',
    topics: [
      'Generics and Utility Types (Partial, Pick, Omit, Record)',
      'Union & Intersection Types',
      'Type Guards and Narrowing',
      'Discriminated Unions',
      'Mapped Types and Conditional Types',
      'Declaration files (.d.ts)',
      'Strict mode and type safety patterns',
    ],
  },
  {
    name: 'React',
    topics: [
      'Virtual DOM and Reconciliation',
      'Hooks deep dive (useState, useEffect, useRef, useMemo, useCallback)',
      'Custom Hooks patterns',
      'Context API vs State Management (Redux, Zustand, Jotai)',
      'React Server Components & Streaming SSR',
      'Error Boundaries',
      'Code Splitting & React.lazy',
      'React 19 features (use, Actions, Suspense improvements)',
    ],
  },
  {
    name: 'Vue.js',
    topics: [
      'Reactivity system (ref, reactive, computed, watch)',
      'Composition API vs Options API',
      'Component lifecycle',
      'Pinia state management',
      'Vue Router (guards, lazy loading)',
      'Teleport, Suspense, and custom directives',
      'Provide/Inject pattern',
    ],
  },
  {
    name: 'CSS & Layout',
    topics: [
      'Flexbox and Grid mastery',
      'CSS Specificity and Cascade',
      'BEM methodology',
      'CSS-in-JS vs CSS Modules vs Tailwind',
      'Responsive design & media queries',
      'CSS Custom Properties (variables)',
      'Container Queries',
      'CSS Animations & Transitions (hardware acceleration)',
    ],
  },
  {
    name: 'Web Performance',
    topics: [
      'Core Web Vitals (LCP, FID, CLS, INP)',
      'Bundle size optimization (tree shaking, code splitting)',
      'Image optimization (lazy loading, modern formats, srcset)',
      'Service Workers and Caching strategies',
      'Critical Rendering Path',
      'Lighthouse and DevTools profiling',
      'Preload, Prefetch, Preconnect',
      'Web Workers for heavy computation',
    ],
  },
  {
    name: 'Browser & Web APIs',
    topics: [
      'DOM manipulation and event delegation',
      'Fetch API and AbortController',
      'IntersectionObserver and ResizeObserver',
      'Web Storage (localStorage, sessionStorage, IndexedDB)',
      'WebSockets and Server-Sent Events',
      'History API and client-side routing',
      'Security: XSS, CSRF, CSP, CORS',
    ],
  },
  {
    name: 'Testing',
    topics: [
      'Unit testing with Jest/Vitest',
      'Component testing with Testing Library',
      'E2E testing with Playwright/Cypress',
      'Mocking strategies',
      'Test-driven development (TDD) for UI',
      'Visual regression testing',
    ],
  },
]

const machineRound = [
  { name: 'Build an Autocomplete/Typeahead', difficulty: 'Medium', skills: ['Debounce', 'API', 'Accessibility'] },
  { name: 'Implement Infinite Scroll', difficulty: 'Medium', skills: ['IntersectionObserver', 'Virtualization'] },
  { name: 'Build a Kanban Board (drag & drop)', difficulty: 'Hard', skills: ['DnD API', 'State Management'] },
  { name: 'Create a Star Rating Component', difficulty: 'Easy', skills: ['Events', 'Accessibility', 'CSS'] },
  { name: 'Build a Modal/Dialog System', difficulty: 'Easy', skills: ['Portal', 'Focus Trap', 'Keyboard Nav'] },
  { name: 'Implement Undo/Redo in a Text Editor', difficulty: 'Hard', skills: ['Command Pattern', 'Stack'] },
  { name: 'Build a File Explorer (tree view)', difficulty: 'Medium', skills: ['Recursion', 'Tree', 'Lazy Loading'] },
  { name: 'Create a Data Table with Sort/Filter', difficulty: 'Medium', skills: ['Performance', 'Virtualization'] },
]
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-desktop"></i> Frontend Interview Prep</h1>
      <p>JavaScript, frameworks, CSS, performance, and machine coding rounds</p>
    </div>

    <h2 style="margin-bottom: 1rem">Core Topics</h2>
    <Accordion multiple>
      <AccordionPanel v-for="(cat, i) in categories" :key="i" :value="String(i)">
        <AccordionHeader>{{ cat.name }}</AccordionHeader>
        <AccordionContent>
          <ul class="topic-list">
            <li v-for="t in cat.topics" :key="t">{{ t }}</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <h2 style="margin: 2rem 0 1rem">Machine Coding Round</h2>
    <p style="color: var(--p-text-muted-color); margin-bottom: 1rem">
      Common frontend live coding challenges. Practice building these from scratch in 60-90 minutes.
    </p>
    <div class="machine-grid">
      <Card v-for="m in machineRound" :key="m.name">
        <template #title>
          {{ m.name }}
          <Tag
            :value="m.difficulty"
            :severity="m.difficulty === 'Hard' ? 'danger' : m.difficulty === 'Medium' ? 'warn' : 'success'"
            style="margin-left: 0.5rem; vertical-align: middle"
          />
        </template>
        <template #content>
          <div class="skill-tags">
            <Tag v-for="s in m.skills" :key="s" :value="s" severity="info" rounded style="margin: 0.2rem" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.topic-list {
  padding-left: 1.5rem;
  line-height: 2;
}

.machine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
}
</style>
