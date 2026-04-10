import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/config/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true) // true until Firebase checks initial auth state
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName || 'Hunter')
  const photoURL = computed(() => user.value?.photoURL || '')
  const email = computed(() => user.value?.email || '')

  // Listen to auth state changes (persists across refreshes)
  onAuthStateChanged(auth, (firebaseUser) => {
    user.value = firebaseUser
    loading.value = false
  })

  async function signInWithGoogle() {
    error.value = null
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Sign-in failed'
      console.error('Google sign-in error:', err)
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth)
      user.value = null
    } catch (err: unknown) {
      console.error('Sign-out error:', err)
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    displayName,
    photoURL,
    email,
    signInWithGoogle,
    signOut,
  }
})
