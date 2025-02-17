<template>
  <q-page class="flex flex-center">
    <q-card class="auth-card q-pa-lg">
      <q-card-section>
        <div class="text-h6">Complete Your Profile</div>
        <div class="text-subtitle2">Please provide your email address to continue</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="onEmailSubmit" class="q-gutter-md">
          <q-input
            v-model="email"
            label="Email"
            type="email"
            :rules="[
              val => !!val || 'Email is required',
              val => /^[^@]+@[^@]+\.[^@]+$/.test(val) || 'Please enter a valid email'
            ]"
          />

          <div class="text-caption text-grey-7">
            Your email will be used for important notifications and account recovery
          </div>

          <q-card-actions align="right" class="q-mt-md">
            <q-btn
              label="Submit"
              type="submit"
              color="primary"
              :loading="loading"
            />
          </q-card-actions>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { useNotification } from '../../composables/useNotification'
import { authApi } from '../../api/auth'

const authStore = useAuthStore()
const { success, error: showError } = useNotification()
const email = ref('')
const loading = ref(false)

const onEmailSubmit = async () => {
  loading.value = true
  try {
    const user = authStore.getUser
    const response = await authApi.updateMe({
      ...user,
      email: email.value
    })

    authStore.actionSetUser(response.data)
    success('Email updated successfully')
    window.location.replace('/')
  } catch (err) {
    console.error('Failed to update email:', err)
    showError('Failed to update email')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.auth-card {
  width: 100%;
  max-width: 400px;
}
</style>
