<script setup lang="ts">
import { EventEntity } from 'src/types'
import { formatDate } from 'src/utils/dateUtils.ts'
import { onMounted, ref } from 'vue'
import { groupsApi } from 'src/api/groups.ts'

const events = ref<EventEntity[]>([])
const loaded = ref<boolean>(false)

onMounted(() => {
  groupsApi.similarEvents().then(res => {
    events.value = res.data
  })
})
</script>

<template>
  <div class="row" v-if="loaded">
    <div class="col-12 col-md-6 col-lg-4" v-for="event in events" :key="event.id">
      <q-card clickable v-ripple @click="$emit('view', event.id)">
        <q-card-section>
          <q-item-label>{{ event.name }}</q-item-label>
          <q-item-label caption>
            {{ formatDate(event.startDate) }}
          </q-item-label>
          <q-item-label caption v-if="event.group">
            Organized by {{ event.group.name }}
          </q-item-label>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
