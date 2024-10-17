<template>
  <q-form @submit="handleSubmit" style="max-width: 500px">

    <div class="text-body1">Set group privacy</div>

    <q-list class="q-mt-md">
      <q-item tag="label" v-ripple>
        <q-item-section avatar>
          <q-radio v-model="privacy" val="public"/>
        </q-item-section>
        <q-item-section>
          <q-item-label>Public</q-item-label>
          <q-item-label caption>Anyone can join and view the group.</q-item-label>
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section avatar>
          <q-radio
            v-model="privacy"
            val="authenticated"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>Authenticated</q-item-label>
          <q-item-label caption>Only registered users can view and join the group.</q-item-label>
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section avatar top>
          <q-radio v-model="privacy" val="private"/>
        </q-item-section>
        <q-item-section>
          <q-item-label>Private</q-item-label>
          <q-item-label caption>Only invited users can view and join the group.</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="q-mt-md">
      <q-btn label="TODO" type="submit" color="primary" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const privacy = ref<'public' | 'authenticated' | 'private'>('public')

const handleSubmit = () => {
  console.log('Selected Privacy:', privacy.value)
  // Add form submission logic here
}
</script>

<style scoped>
/* Optional: You can add custom styles here */
</style>
