import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '@/stores/authStore'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    fullBleed?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('../views/GuestHomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/ds',
      name: 'data-structures',
      component: () => import('../views/DataStructuresView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/hld',
      name: 'hld',
      component: () => import('../views/HLDView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/hld/:slug',
      name: 'hld-detail',
      component: () => import('../views/HLDDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/hld/:slug/simulate',
      name: 'hld-simulator',
      component: () => import('../views/HLDSimulatorView.vue'),
      meta: { requiresAuth: true, fullBleed: true },
    },
    {
      path: '/lld',
      name: 'lld',
      component: () => import('../views/LLDView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/lld/:slug',
      name: 'lld-detail',
      component: () => import('../views/LLDDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/lld/:slug/practice',
      name: 'lld-practice',
      component: () => import('../views/LLDPracticeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/concepts',
      name: 'concepts',
      component: () => import('../views/ConceptsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/concepts/:slug',
      name: 'concept-detail',
      component: () => import('../views/ConceptDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/draw',
      name: 'whiteboard',
      component: () => import('../views/WhiteboardView.vue'),
      meta: { requiresAuth: true, fullBleed: true },
    },
    {
      path: '/frontend',
      name: 'frontend',
      component: () => import('../views/FrontendView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/backend',
      name: 'backend',
      component: () => import('../views/BackendView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('../views/TechNewsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('../views/JobsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/jobs/target-companies/:level?',
      name: 'target-companies',
      component: () => import('../views/TargetCompaniesView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  await authStore.authReady

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'home' && !authStore.isAuthenticated) {
    return { name: 'welcome' }
  }

  if ((to.name === 'welcome' || to.name === 'login') && authStore.isAuthenticated) {
    return { name: 'home' }
  }
})

export default router
