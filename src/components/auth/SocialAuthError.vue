<template>
  <q-card class="social-auth-error-card q-pa-md">
    <q-card-section>
      <div class="text-h6 text-negative">
        <q-icon name="warning" class="q-mr-sm" />
        Authentication Failed
      </div>
      <div class="text-body2 q-mt-md">{{ errorMessage }}</div>
      
      <!-- Enhanced error display for social auth conflicts -->
      <div v-if="suggestedProvider" class="q-mt-md">
        <q-separator class="q-my-md" />
        <div class="text-subtitle2 text-primary">What should I do?</div>
        <div class="text-body2 q-mt-sm">
          {{ getSuggestedAction() }}
        </div>
      </div>
    </q-card-section>
    
    <q-card-actions align="right" class="q-pt-none">
      <!-- Action button for suggested provider -->
      <q-btn 
        v-if="suggestedProvider && suggestedProvider !== 'email'" 
        :label="getSuggestedButtonText()" 
        :color="getProviderColor(suggestedProvider)"
        :icon="getProviderIcon(suggestedProvider)"
        @click="handleSuggestedAction"
        class="q-mr-sm"
      />
      
      <!-- Email login button for email suggestion -->
      <q-btn 
        v-if="suggestedProvider === 'email'"
        label="Use Email Login"
        color="primary"
        icon="email"
        @click="goToEmailLogin"
        class="q-mr-sm"
      />
      
      <!-- Try again button -->
      <q-btn 
        flat 
        label="Try Again" 
        color="primary" 
        @click="handleTryAgain" 
      />
      
      <!-- Cancel/Close button -->
      <q-btn 
        flat 
        label="Cancel" 
        color="grey" 
        @click="handleCancel" 
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  error: string
  authProvider?: string
  suggestedProvider?: string
  isPopup?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  authProvider: '',
  suggestedProvider: '',
  isPopup: false
})

const emit = defineEmits<{
  tryAgain: []
  cancel: []
  useProvider: [provider: string]
  useEmailLogin: []
}>()

const errorMessage = computed(() => {
  // Clean up the error message by removing provider-specific parts if we have suggestion
  if (props.suggestedProvider && props.error.includes('Please sign in using')) {
    const parts = props.error.split('Please sign in using')
    return parts[0].trim()
  }
  return props.error
})

const getSuggestedAction = () => {
  if (!props.suggestedProvider) return ''
  
  const providerNames = {
    google: 'Google',
    github: 'GitHub', 
    bluesky: 'Bluesky',
    email: 'email and password'
  }
  
  const providerName = providerNames[props.suggestedProvider] || props.suggestedProvider
  return `Try signing in with ${providerName} instead, which is linked to this email address.`
}

const getSuggestedButtonText = () => {
  const providerNames = {
    google: 'Use Google',
    github: 'Use GitHub',
    bluesky: 'Use Bluesky'
  }
  return providerNames[props.suggestedProvider] || `Use ${props.suggestedProvider}`
}

const getProviderColor = (provider: string) => {
  const colors = {
    google: 'red',
    github: 'dark',
    bluesky: 'blue'
  }
  return colors[provider] || 'primary'
}

const getProviderIcon = (provider: string) => {
  const icons = {
    google: 'fab fa-google',
    github: 'fab fa-github', 
    bluesky: 'cloud'
  }
  return icons[provider] || 'login'
}

const handleSuggestedAction = () => {
  emit('useProvider', props.suggestedProvider)
}

const goToEmailLogin = () => {
  emit('useEmailLogin')
}

const handleTryAgain = () => {
  emit('tryAgain')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.social-auth-error-card {
  max-width: 500px;
  width: 90%;
}
</style>