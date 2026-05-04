<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import Menubar from 'primevue/menubar'
import { useRouter } from 'vue-router'

const router = useRouter()

const items = ref([
  { label: 'Home', icon: 'pi pi-home', command: () => router.push('/') },
  {
    label: 'Interview Prep',
    icon: 'pi pi-book',
    items: [
      { label: 'Data Structures & Algo', icon: 'pi pi-sitemap', command: () => router.push('/ds') },
      { label: 'High Level Design', icon: 'pi pi-globe', command: () => router.push('/hld') },
      { label: 'Low Level Design', icon: 'pi pi-cog', command: () => router.push('/lld') },
      { label: 'Frontend', icon: 'pi pi-desktop', command: () => router.push('/frontend') },
      { label: 'Backend', icon: 'pi pi-server', command: () => router.push('/backend') },
    ],
  },
  { label: 'Tech News', icon: 'pi pi-megaphone', command: () => router.push('/news') },
  { label: 'Job Postings', icon: 'pi pi-briefcase', command: () => router.push('/jobs') },
])
</script>

<template>
  <div class="app-container">
    <Menubar :model="items" class="app-menubar">
      <template #start>
        <RouterLink to="/" class="app-logo">
          <i class="pi pi-bolt" style="font-size: 1.5rem; color: var(--p-primary-color)"></i>
          <span class="logo-text">TechPrep Hub</span>
        </RouterLink>
      </template>
    </Menubar>

    <main class="main-content">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>TechPrep Hub - Your one-stop interview preparation resource</p>
    </footer>
  </div>
</template>

<style>
:root {
  --app-max-width: 1200px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f8f9fa;
  color: #1e293b;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-menubar {
  border-radius: 0 !important;
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  margin-right: 1.5rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.main-content {
  flex: 1;
  max-width: var(--app-max-width);
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.app-footer {
  text-align: center;
  padding: 1.5rem;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-bottom: 0.5rem;
}

.section-header p {
  color: var(--p-text-muted-color);
  font-size: 1.1rem;
}

.topic-card {
  margin-bottom: 1rem;
}

.topic-card h3 {
  color: var(--p-primary-color);
  margin-bottom: 0.5rem;
}

.topic-card ul {
  padding-left: 1.5rem;
  line-height: 1.8;
}

.difficulty-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.easy { background: #dcfce7; color: #166534; }
.medium { background: #fef3c7; color: #92400e; }
.hard { background: #fce7f3; color: #9d174d; }
</style>
