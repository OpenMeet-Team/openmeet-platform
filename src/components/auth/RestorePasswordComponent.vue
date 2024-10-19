<template>
  <q-page padding>
    <div class="row justify-center q-pt-lg">
      <q-form @submit="onSubmit" class="q-gutter-md">
    <q-card class="restore-password-card">
        <q-card-section>
          <div class="text-h5 text-bold">Restore Password</div>
        </q-card-section>

        <q-card-section>
          <p class="text-body2 q-mb-md">
            Please enter your new password.
          </p>
            <q-input
              filled
              v-model="password"
              label="New Password"
              :type="isPwd ? 'password' : 'text'"
              :rules="[
              (val: string) => !!val || 'Password is required',
              (val: string) => val.length >= 8 || 'Password must be at least 8 characters'
            ]"
            >
              <template v-slot:append>
                <q-icon
                  :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                  class="cursor-pointer"
                  @click="isPwd = !isPwd"
                />
              </template>
            </q-input>

            <div class="text-grey-6">
              Remember your password?
              <AuthLoginLinkComponent/>
            </div>

            <div class="q-mt-md">
              <q-btn
                no-caps
                label="Reset password"
                type="submit"
                color="primary"
                :loading="loading"
              />
            </div>
        </q-card-section>
      </q-card>
      </q-form>

      <q-dialog v-model="showSuccessDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">New Password is set!</div>
          </q-card-section>

          <q-card-section>
            Please log in using your newly created password
          </q-card-section>

          <q-card-actions>
            <q-btn flat no-caps label="OK" color="primary" :to="{ name: 'AuthLoginPage' }" v-close-popup/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'stores/auth-store.ts'
import { useNotification } from 'src/composables/useNotification.ts'
import { useMeta } from 'quasar'
import AuthLoginLinkComponent from 'components/auth/AuthLoginLinkComponent.vue'

const route = useRoute()
const authStore = useAuthStore()

const password = ref<string>('')
const hash: string = (route.query.hash as string | null) ?? ''
const isPwd = ref<boolean>(true)
const loading = ref<boolean>(false)
const showSuccessDialog = ref<boolean>(false)

const { error } = useNotification()
const onSubmit = async () => {
  try {
    loading.value = true
    await authStore.actionRestorePassword({ password: password.value, hash })

    showSuccessDialog.value = true

    // Reset form field after successful submission
    password.value = ''
  } catch (err) {
    error('Failed to reset password. Please try again.')
  } finally {
    loading.value = false
  }
}

useMeta({
  title: 'Restore Password'
})
</script>

<style scoped>
.restore-password-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
