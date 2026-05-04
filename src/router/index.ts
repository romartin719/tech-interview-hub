import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/ds',
      name: 'data-structures',
      component: () => import('../views/DataStructuresView.vue'),
    },
    {
      path: '/hld',
      name: 'hld',
      component: () => import('../views/HLDView.vue'),
    },
    {
      path: '/lld',
      name: 'lld',
      component: () => import('../views/LLDView.vue'),
    },
    {
      path: '/frontend',
      name: 'frontend',
      component: () => import('../views/FrontendView.vue'),
    },
    {
      path: '/backend',
      name: 'backend',
      component: () => import('../views/BackendView.vue'),
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('../views/TechNewsView.vue'),
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('../views/JobsView.vue'),
    },
  ],
})

export default router
