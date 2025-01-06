<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input filled label-color="primary" bg-color="white" data-cy="mail-signup" outlined v-model="formData.email" type="email" label="Your email" lazy-rules
             :rules="[val => validateEmail(val) || 'Please enter a valid email']">
      <template v-slot:append>
        <q-btn color="primary" data-cy="mail-signup-submit" round dense @click="onSubmit" type="submit" flat icon="sym_r_send"/>
      </template>
    </q-input>
  </q-form>
</template>

<script setup>
import { ref } from 'vue'
import { validateEmail } from 'src/utils/validation'
import axios from 'axios'
import { useNotification } from 'src/composables/useNotification'
import getEnv from 'src/utils/env'

const formData = ref({
  email: ''
})
const { success, error } = useNotification()

const onSubmit = () => {
  if (validateEmail(formData.value.email)) {
    axios.post(`https://api.hsforms.com/submissions/v3/integration/submit/${getEnv('APP_HUBSPOT_PORTAL_ID')}/${getEnv('APP_HUBSPOT_FORM_ID')}`, {
      fields: [
        { name: 'email', value: formData.value.email }
      ]
    }).then(() => {
      success('Thank you for subscribing to our newsletter!')
      formData.value.email = ''
    }).catch((e) => {
      console.log(e)
      error('Something went wrong. Please try again later')
    })
  } else {
    error('Please enter a valid email address.')
  }
}

</script>
