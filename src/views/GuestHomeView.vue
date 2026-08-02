<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const stats = [
  { value: '7', label: 'Prep Tracks' },
  { value: '300+', label: 'DSA Problems' },
  { value: 'Live', label: 'Tech News' },
  { value: 'Free', label: 'Forever' },
]

const features = [
  {
    accent: '#818cf8',
    title: 'All Your Prep, One Place',
    description:
      'DSA, system design, frontend, backend, tech news, and job postings — stop juggling five different sites.',
  },
  {
    accent: '#10b981',
    title: 'Curated & Practical',
    description:
      'Hand-picked problems and concepts, not endless lists. Focused on what interviewers actually ask.',
  },
  {
    accent: '#f59e0b',
    title: 'Free Forever',
    description: 'No paywalls, no premium tier. Full access to everything from day one.',
  },
]

const sections = [
  {
    title: 'Data Structures & Algorithms',
    icon: 'pi pi-sitemap',
    description:
      'Arrays, Trees, Graphs, DP, Sorting — master the fundamentals with 300+ curated LeetCode problems organized by topic and difficulty.',
    color: '#3b82f6',
    tag: 'DSA',
  },
  {
    title: 'High Level Design',
    icon: 'pi pi-globe',
    description:
      'System design for distributed systems, scalability, and architecture — concepts, frameworks, and practice problems.',
    color: '#8b5cf6',
    tag: 'HLD',
  },
  {
    title: 'Low Level Design',
    icon: 'pi pi-cog',
    description: 'OOP, design patterns, SOLID principles, and class-level design with worked examples.',
    color: '#f59e0b',
    tag: 'LLD',
  },
  {
    title: 'Frontend',
    icon: 'pi pi-desktop',
    description:
      'JavaScript, React, Vue, CSS, performance, and web fundamentals — interview topics and machine coding rounds.',
    color: '#10b981',
    tag: 'Frontend',
  },
  {
    title: 'Backend',
    icon: 'pi pi-server',
    description: 'APIs, databases, caching, messaging, and server-side engineering — everything you need for a backend interview.',
    color: '#ef4444',
    tag: 'Backend',
  },
  {
    title: 'Tech News',
    icon: 'pi pi-megaphone',
    description: 'Curated tech headlines, GitHub trending repos, and market insights to stay sharp and current.',
    color: '#06b6d4',
    tag: 'News',
  },
  {
    title: 'Job Postings',
    icon: 'pi pi-briefcase',
    description: 'YC startup listings, big tech hiring overviews, and the hottest skills in demand — all in one place.',
    color: '#ec4899',
    tag: 'Jobs',
  },
]

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="guest-home">
    <section class="hero">
      <p class="sc-badge-line">One free platform for DSA, system design, and job prep</p>
      <h1 class="hero-title">
        Ace Every Interview Round —
        <span class="sc-gradient-text">DSA, HLD &amp; LLD</span>
      </h1>
      <p class="hero-subtitle">
        Master data structures &amp; algorithms, high-level system design, and low-level machine
        coding — plus frontend, backend prep, live tech news, and curated job postings, all in one
        place.
      </p>
      <button class="sc-btn-primary hero-cta" @click="goToLogin">
        <i class="pi pi-google"></i>
        Sign in with Google to get started
      </button>
      <p class="hero-meta">Free &middot; DSA &middot; HLD &middot; LLD &middot; New content added weekly</p>
    </section>

    <section class="stats-row">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </section>

    <section class="why-section">
      <h2 class="section-title">Why engineers prefer TechPrep Hub</h2>
      <p class="section-subtitle">Not just another list of problems. Here's what's different.</p>
      <div class="features-grid">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="sc-card feature-card"
          :style="{ borderTopColor: feature.accent }"
        >
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <section class="path-section">
      <h2 class="section-title">Choose your interview round</h2>
      <p class="section-subtitle">Sign in to unlock every section — all curated, all free.</p>
      <div class="cards-grid">
        <div v-for="section in sections" :key="section.title" class="sc-card section-card">
          <div class="card-icon-chip" :style="{ background: section.color }">
            <i :class="section.icon"></i>
          </div>
          <h3 class="card-title">{{ section.title }}</h3>
          <p class="card-description">{{ section.description }}</p>
          <span class="sc-tag">{{ section.tag }}</span>
          <button class="unlock-btn" @click="goToLogin">
            <i class="pi pi-lock"></i>
            Sign in to unlock
          </button>
        </div>
      </div>
    </section>

    <section class="cta-banner sc-banner">
      <div>
        <p class="banner-title">New: Live tech news &amp; curated job postings</p>
        <p class="banner-subtitle">
          Stay current with trending repos and market insights, and browse hand-picked openings from
          YC startups and big tech — sign in to unlock both.
        </p>
      </div>
      <button class="sc-btn-on-banner" @click="goToLogin">
        Explore
        <i class="pi pi-arrow-right"></i>
      </button>
    </section>
  </div>
</template>

<style scoped>
.guest-home {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
  padding-bottom: 1rem;
}

.hero {
  text-align: center;
  padding: 1.5rem 0 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--sc-text);
  line-height: 1.15;
  max-width: 720px;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--sc-text-muted);
  max-width: 620px;
  line-height: 1.6;
}

.hero-cta {
  margin-top: 0.5rem;
  font-size: 1rem;
  padding: 0.85rem 1.75rem;
}

.hero-meta {
  color: var(--sc-text-muted);
  font-size: 0.8rem;
}

.stats-row {
  display: flex;
  justify-content: center;
  gap: 3rem;
  flex-wrap: wrap;
  padding: 1.5rem 0;
  border-top: 1px solid var(--sc-border);
  border-bottom: 1px solid var(--sc-border);
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--sc-accent-2);
}

.stat-label {
  color: var(--sc-text-muted);
  font-size: 0.9rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.35rem;
}

.section-subtitle {
  color: var(--sc-text-muted);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  border-top: 3px solid;
  padding: 1.5rem;
}

.feature-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.5rem;
}

.feature-description {
  color: var(--sc-text-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.section-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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
  margin-bottom: 0.25rem;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--sc-text);
}

.card-description {
  color: var(--sc-text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
  flex: 1;
}

.unlock-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--sc-text-muted);
  font-family: var(--sc-font);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.4rem 0;
  align-self: flex-start;
}

.unlock-btn:hover {
  color: var(--sc-accent-2);
}

.cta-banner {
  margin-bottom: 1rem;
}

.banner-title {
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 0.35rem;
}

.banner-subtitle {
  font-size: 0.9rem;
  opacity: 0.9;
  max-width: 520px;
  line-height: 1.5;
}
</style>
