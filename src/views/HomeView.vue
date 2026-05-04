<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

const router = useRouter()

const sections = [
  {
    title: 'Data Structures & Algorithms',
    icon: 'pi pi-sitemap',
    description: 'Arrays, Trees, Graphs, DP, Sorting — master the fundamentals.',
    route: '/ds',
    color: '#3b82f6',
  },
  {
    title: 'High Level Design',
    icon: 'pi pi-globe',
    description: 'System design for distributed systems, scalability, and architecture.',
    route: '/hld',
    color: '#8b5cf6',
  },
  {
    title: 'Low Level Design',
    icon: 'pi pi-cog',
    description: 'OOP, design patterns, SOLID principles, and class-level design.',
    route: '/lld',
    color: '#f59e0b',
  },
  {
    title: 'Frontend',
    icon: 'pi pi-desktop',
    description: 'JavaScript, React, Vue, CSS, performance, and web fundamentals.',
    route: '/frontend',
    color: '#10b981',
  },
  {
    title: 'Backend',
    icon: 'pi pi-server',
    description: 'APIs, databases, caching, messaging, and server-side engineering.',
    route: '/backend',
    color: '#ef4444',
  },
  {
    title: 'Tech News',
    icon: 'pi pi-megaphone',
    description: 'Latest tech news from LinkedIn, Twitter/X, and the industry.',
    route: '/news',
    color: '#06b6d4',
  },
  {
    title: 'Job Postings',
    icon: 'pi pi-briefcase',
    description: 'Recent software engineering job openings from top companies.',
    route: '/jobs',
    color: '#ec4899',
  },
]
</script>

<template>
  <div class="home">
    <div class="hero">
      <h1><i class="pi pi-bolt"></i> TechPrep Hub</h1>
      <p class="hero-subtitle">
        Your complete interview preparation toolkit — DSA, System Design, Frontend, Backend, plus
        live tech news and job postings.
      </p>
    </div>

    <div class="cards-grid">
      <Card
        v-for="section in sections"
        :key="section.route"
        class="section-card"
        @click="router.push(section.route)"
      >
        <template #header>
          <div class="card-icon-bar" :style="{ background: section.color }">
            <i :class="section.icon" style="font-size: 1.5rem; color: white"></i>
          </div>
        </template>
        <template #title>{{ section.title }}</template>
        <template #content>
          <p>{{ section.description }}</p>
        </template>
        <template #footer>
          <Button
            label="Explore"
            icon="pi pi-arrow-right"
            iconPos="right"
            text
            @click.stop="router.push(section.route)"
          />
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem 0;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--p-primary-color);
}

.hero-subtitle {
  margin-top: 0.75rem;
  font-size: 1.15rem;
  color: var(--p-text-muted-color);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.section-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.section-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.card-icon-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  border-radius: 8px 8px 0 0;
}
</style>
