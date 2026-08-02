<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ close: [] }>()

const steps = [
  {
    title: 'Welcome to the System Design Simulator',
    body: "Your goal: build an architecture that meets the requirements and survives a live traffic test. It's the same thinking a system-design interview tests — except here you can actually run your design and watch where it breaks.",
  },
  {
    title: 'Build your architecture',
    body: 'Drag components from the left palette onto the canvas. Drag from a node\'s handle to another node to connect them. Use the −/+ stepper to add more instances of a component.',
  },
  {
    title: 'Run Traffic',
    body: 'Click "Run Traffic" to send the target load through your design. Nodes turn amber or red when they can\'t keep up, and the metrics bar shows throughput, latency, error rate, and cache hit rate.',
  },
  {
    title: 'Evaluate',
    body: 'Click "Evaluate" to check your design against an interview rubric and see a reference architecture. Keep iterating until you clear every criterion.',
  },
]

const stepIndex = ref(0)

function next() {
  if (stepIndex.value < steps.length - 1) {
    stepIndex.value += 1
  } else {
    emit('close')
  }
}

function skip() {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="skip">
    <div class="modal-panel sc-card">
      <button class="modal-close" @click="skip">×</button>
      <h2>{{ steps[stepIndex]?.title }}</h2>
      <p>{{ steps[stepIndex]?.body }}</p>
      <div class="tour-footer">
        <div class="dots">
          <span v-for="(_, i) in steps" :key="i" class="dot" :class="{ active: i === stepIndex }"></span>
        </div>
        <div class="tour-actions">
          <button class="sc-btn-secondary" @click="skip">Skip</button>
          <button class="sc-btn-primary" @click="next">{{ stepIndex === steps.length - 1 ? 'Done' : 'Next' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 2rem;
}

.modal-panel {
  position: relative;
  max-width: 440px;
  width: 100%;
  padding: 2rem;
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: var(--sc-text-muted);
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: var(--sc-text);
}

h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--sc-text);
  margin-bottom: 0.75rem;
  padding-right: 1.5rem;
}

p {
  color: var(--sc-text-muted);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.tour-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dots {
  display: flex;
  gap: 0.4rem;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sc-border);
}

.dot.active {
  background: var(--sc-accent);
}

.tour-actions {
  display: flex;
  gap: 0.6rem;
}
</style>
