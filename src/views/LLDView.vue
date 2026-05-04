<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

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

const designPatterns = [
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

const lldProblems = [
  { name: 'Design Parking Lot', difficulty: 'Easy', patterns: ['Strategy', 'Factory', 'Observer'] },
  { name: 'Design Elevator System', difficulty: 'Medium', patterns: ['State', 'Strategy', 'Observer'] },
  { name: 'Design Chess Game', difficulty: 'Medium', patterns: ['Strategy', 'Command', 'Observer'] },
  { name: 'Design Vending Machine', difficulty: 'Easy', patterns: ['State', 'Factory'] },
  { name: 'Design Library Management', difficulty: 'Easy', patterns: ['Observer', 'Factory', 'Singleton'] },
  { name: 'Design Hotel Booking', difficulty: 'Medium', patterns: ['Strategy', 'Observer', 'Builder'] },
  { name: 'Design Snake & Ladder Game', difficulty: 'Easy', patterns: ['State', 'Strategy'] },
  { name: 'Design File System', difficulty: 'Medium', patterns: ['Composite', 'Iterator'] },
  { name: 'Design LRU Cache', difficulty: 'Medium', patterns: ['Proxy', 'Singleton'] },
  { name: 'Design Payment System', difficulty: 'Hard', patterns: ['Strategy', 'Factory', 'Chain of Responsibility'] },
]
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-cog"></i> Low Level Design (LLD)</h1>
      <p>Object-oriented design, patterns, and class-level architecture</p>
    </div>

    <h2 style="margin-bottom: 1rem">SOLID Principles</h2>
    <div class="solid-grid">
      <Card v-for="p in solidPrinciples" :key="p.letter" class="solid-card">
        <template #title>
          <span class="solid-letter">{{ p.letter }}</span> {{ p.name }}
        </template>
        <template #content>
          <p><strong>Principle:</strong> {{ p.description }}</p>
          <p class="example-text"><i class="pi pi-code"></i> {{ p.example }}</p>
        </template>
      </Card>
    </div>

    <h2 style="margin: 2rem 0 1rem">Design Patterns</h2>
    <Accordion multiple>
      <AccordionPanel v-for="(cat, i) in designPatterns" :key="i" :value="String(i)">
        <AccordionHeader>{{ cat.category }} Patterns</AccordionHeader>
        <AccordionContent>
          <div class="pattern-list">
            <div v-for="p in cat.patterns" :key="p.name" class="pattern-item">
              <strong>{{ p.name }}</strong>
              <span class="pattern-use">{{ p.use }}</span>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <h2 style="margin: 2rem 0 1rem">Practice Problems</h2>
    <div class="problems-grid">
      <Card v-for="prob in lldProblems" :key="prob.name" class="problem-card">
        <template #title>
          {{ prob.name }}
          <Tag
            :value="prob.difficulty"
            :severity="prob.difficulty === 'Hard' ? 'danger' : prob.difficulty === 'Medium' ? 'warn' : 'success'"
            style="margin-left: 0.5rem; vertical-align: middle"
          />
        </template>
        <template #content>
          <div class="pattern-tags">
            <Tag v-for="p in prob.patterns" :key="p" :value="p" severity="secondary" rounded style="margin: 0.2rem" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.solid-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.solid-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--p-primary-color);
  color: white;
  font-weight: 800;
  font-size: 1rem;
  margin-right: 0.5rem;
}

.example-text {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #475569;
}

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pattern-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.pattern-use {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.problems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.pattern-tags {
  display: flex;
  flex-wrap: wrap;
}
</style>
