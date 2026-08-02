<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const error = ref<string | null>(null)
const signingIn = ref(false)

async function handleGoogleSignIn() {
  error.value = null
  signingIn.value = true
  try {
    await authStore.signInWithGoogle()
    const redirect = route.query.redirect as string | undefined
    router.push(redirect ?? '/')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Sign-in error:', e)
    if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
      error.value = msg || 'Sign-in failed. Please try again.'
    }
  } finally {
    signingIn.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <Card class="login-card">
      <template #header>
        <div class="login-header">
          <span class="login-logo-badge"><i class="pi pi-bolt"></i></span>
          <h1 class="login-logo-text">TechPrep Hub</h1>
        </div>
      </template>
      <template #content>
        <div class="login-content">
          <h2 class="login-title">Sign in to get started</h2>
          <p class="login-subtitle">
            Access 300+ DSA problems, system design guides, frontend & backend prep, tech news, and
            job postings.
          </p>

          <Message v-if="error" severity="error" :closable="false" class="login-error">
            {{ error }}
          </Message>

          <Button
            label="Sign in with Google"
            icon="pi pi-google"
            size="large"
            class="google-btn"
            :loading="signingIn"
            @click="handleGoogleSignIn"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--sc-surface) !important;
  border: 1px solid var(--sc-border) !important;
  border-radius: var(--sc-radius-lg) !important;
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid var(--sc-border);
}

.login-logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--sc-radius-sm);
  background: var(--sc-gradient-primary);
  color: #ffffff;
  font-size: 1.2rem;
}

.login-logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sc-text);
  margin: 0;
}

.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 0.5rem 0;
  text-align: center;
}

.login-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--sc-text);
  margin: 0;
}

.login-subtitle {
  color: var(--sc-text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}

.login-error {
  width: 100%;
}

.google-btn {
  width: 100%;
  background: var(--sc-accent) !important;
  border: none !important;
  border-radius: var(--sc-radius-sm) !important;
  font-weight: 600 !important;
}

.google-btn:hover {
  filter: brightness(1.1);
}
</style>
