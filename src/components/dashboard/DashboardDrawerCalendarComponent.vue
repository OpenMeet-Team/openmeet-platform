<template>
  <div class="q-pa-md">
    <q-date
      class="full-width"
      v-model="date"
      :events="events"
      :event-color="(date) => (date[9] as any % 2 === 0) ? 'teal' : 'orange'"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const date = ref<string>('2019/02/01')
const events = ['2019/02/01', '2019/02/05', '2019/02/06', '2019/02/09', '2019/02/23']
</script>
