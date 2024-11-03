<template>
  <q-page padding>
    <SpinnerComponent v-if="isLoading" />
    <div v-else class="text-center">
      <h1>{{ errorMessage }}</h1>
      <div class="row q-gutter-md justify-center">
        <q-btn data-cy="confirm-new-email-login" color="primary" no-caps label="Go to login" @click="router.push('/auth/login')" />
        <q-btn data-cy="confirm-new-email-home" outline color="primary" no-caps label="Go to home page" @click="router.push('/')" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { authApi } from 'src/api'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')
onMounted(() => {
  const hash = route.query.hash as string
  if (hash) {
    verifyHash(hash)
  }
})

const verifyHash = async (hash: string) => {
  try {
    isLoading.value = true
    await authApi.confirmNewEmail(hash)
    errorMessage.value = 'Email confirmed'
  } catch (error) {
    errorMessage.value = 'Invalid link'
  } finally {
    isLoading.value = false
  }
}

</script>
