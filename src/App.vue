<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Menubar from 'primevue/menubar'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'
import ProgressSpinner from 'primevue/progressspinner'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const isFullBleed = computed(() => route.meta.fullBleed === true)

const userMenu = ref()
const userMenuItems = ref([
  {
    label: 'Sign Out',
    icon: 'pi pi-sign-out',
    command: async () => {
      await authStore.signOut()
      router.push('/welcome')
    },
  },
])

const allNavItems = [
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
      { label: 'Concepts', icon: 'pi pi-book', command: () => router.push('/concepts') },
      { label: 'Whiteboard', icon: 'pi pi-pencil', command: () => router.push('/draw') },
    ],
  },
  { label: 'Tech News', icon: 'pi pi-megaphone', command: () => router.push('/news') },
  { label: 'Job Postings', icon: 'pi pi-briefcase', command: () => router.push('/jobs') },
]

const navItems = computed(() => (authStore.isAuthenticated ? allNavItems : []))

const userInitial = computed(() => {
  const name = authStore.user?.displayName
  return name ? name.charAt(0).toUpperCase() : 'U'
})
</script>

<template>
  <div class="app-container">
    <div class="bg-gradient" aria-hidden="true"></div>

    <div v-if="authStore.loading" class="auth-loading">
      <ProgressSpinner strokeWidth="4" />
    </div>

    <template v-else>
      <Menubar :model="navItems" class="app-menubar">
        <template #start>
          <RouterLink to="/" class="app-logo">
            <span class="logo-badge"><i class="pi pi-bolt"></i></span>
            <span class="logo-text">TechPrep Hub</span>
          </RouterLink>
        </template>
        <template #end>
          <template v-if="authStore.isAuthenticated">
            <Avatar
              :image="authStore.user?.photoURL ?? undefined"
              :label="authStore.user?.photoURL ? undefined : userInitial"
              shape="circle"
              class="user-avatar"
              @click="(e: MouseEvent) => userMenu?.toggle(e)"
            />
            <Menu ref="userMenu" :model="userMenuItems" popup />
          </template>
          <Button
            v-else
            label="Sign In"
            icon="pi pi-sign-in"
            size="small"
            class="sign-in-btn"
            @click="router.push('/login')"
          />
        </template>
      </Menubar>

      <main class="main-content" :class="{ 'main-content--full-bleed': isFullBleed }">
        <RouterView />
      </main>

      <footer class="app-footer">
        <div class="footer-links">
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/ds">DSA</RouterLink>
          <RouterLink to="/hld">HLD</RouterLink>
          <RouterLink to="/lld">LLD</RouterLink>
          <RouterLink to="/concepts">Concepts</RouterLink>
          <RouterLink to="/draw">Whiteboard</RouterLink>
          <RouterLink to="/frontend">Frontend</RouterLink>
          <RouterLink to="/backend">Backend</RouterLink>
          <RouterLink to="/news">Tech News</RouterLink>
          <RouterLink to="/jobs">Jobs</RouterLink>
        </div>
        <p class="footer-copyright">&copy; 2026 TechPrep Hub. Free forever.</p>
      </footer>
    </template>
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
  font-family: var(--sc-font);
  background-color: var(--sc-bg);
  color: var(--sc-text);
}

.app-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--sc-bg);
}

/* Ambient gradient mesh behind the top of the page, ported from
   systemcraft.in's core.css. Fixed so it costs one paint and stays put
   while content scrolls over it; masked so it fades before it ends on a
   hard edge. */
.bg-gradient {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 900px;
  background:
    radial-gradient(ellipse 55% 45% at 50% -6%, color-mix(in srgb, var(--sc-accent) 38%, transparent), transparent 70%),
    radial-gradient(ellipse 42% 38% at 10% 2%, color-mix(in srgb, var(--sc-accent-2) 26%, transparent), transparent 68%),
    radial-gradient(ellipse 42% 40% at 90% 0%, color-mix(in srgb, #38bdf8 20%, transparent), transparent 68%);
  -webkit-mask-image: linear-gradient(180deg, #000 40%, transparent);
  mask-image: linear-gradient(180deg, #000 40%, transparent);
  pointer-events: none;
  z-index: 0;
}

.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sc-bg);
}

.app-menubar {
  position: relative;
  z-index: 1;
  border-radius: 0 !important;
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
  background: rgba(9, 9, 12, 0.72) !important;
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border-bottom: 1px solid var(--sc-border) !important;
}

.app-menubar .p-menubar-item-link {
  color: var(--sc-text-muted);
}

.app-menubar .p-menubar-item-link:hover,
.app-menubar .p-menubar-item.p-focus > .p-menubar-item-content {
  color: var(--sc-text);
  background: rgba(255, 255, 255, 0.05);
}

.app-menubar .p-menubar-submenu {
  background: var(--sc-surface-solid);
  border: 1px solid var(--sc-border);
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  margin-right: 1.5rem;
}

.logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--sc-radius-sm);
  background: var(--sc-gradient-primary);
  color: #ffffff;
  font-size: 1rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sc-text);
}

.sign-in-btn {
  background: var(--sc-accent) !important;
  border: none !important;
  border-radius: var(--sc-radius-sm) !important;
  font-weight: 600 !important;
}

.sign-in-btn:hover {
  filter: brightness(1.1);
}

.user-avatar {
  cursor: pointer;
}

.main-content {
  position: relative;
  z-index: 1;
  flex: 1;
  max-width: var(--app-max-width);
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* Routes like the whiteboard want the full viewport width instead of being
   centered/clipped to the site's normal reading-width content column. */
.main-content--full-bleed {
  max-width: none;
  padding: 1.25rem 1.5rem;
}

.app-footer {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 2rem 1.5rem;
  background: var(--sc-bg);
  border-top: 1px solid var(--sc-border);
  color: var(--sc-text-muted);
  font-size: 0.875rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1rem;
}

.footer-links a {
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.85rem;
}

.footer-links a:hover {
  color: var(--sc-text);
}

.footer-copyright {
  color: var(--sc-text-muted);
  font-size: 0.8rem;
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
