import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  // Resolves once Firebase confirms whether a persisted session exists.
  // Router guard awaits this to avoid wrong redirects on first page load.
  const authReady: Promise<void> = new Promise((resolve) => {
    onAuthStateChanged(auth, (firebaseUser) => {
      user.value = firebaseUser
      loading.value = false
      resolve()
    })
  })

  const isAuthenticated = computed(() => user.value !== null)

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    user.value = result.user
  }

  async function signOut() {
    await firebaseSignOut(auth)
    user.value = null
  }

  return { user, loading, authReady, isAuthenticated, signInWithGoogle, signOut }
})
