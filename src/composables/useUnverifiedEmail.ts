import { ref } from 'vue'

// Shared reactive state for unverified email
const unverifiedEmail = ref<string | null>(null)

// Initialize from localStorage
const storedEmail = localStorage.getItem('unverified_email')
if (storedEmail) {
  unverifiedEmail.value = storedEmail
}

export function useUnverifiedEmail () {
  const setUnverifiedEmail = (email: string) => {
    localStorage.setItem('unverified_email', email)
    unverifiedEmail.value = email
  }

  const clearUnverifiedEmail = () => {
    localStorage.removeItem('unverified_email')
    unverifiedEmail.value = null
  }

  return {
    unverifiedEmail,
    setUnverifiedEmail,
    clearUnverifiedEmail
  }
}
