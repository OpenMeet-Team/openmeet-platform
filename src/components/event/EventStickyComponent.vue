<script setup lang="ts">

import ShareComponent from 'components/common/ShareComponent.vue'
import { EventEntity } from 'src/types'
import { formatDate } from '../../utils/dateUtils.ts'
import { Dark } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import { useEventStore } from 'stores/event-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'

interface Props {
  event: EventEntity
}

const props = defineProps<Props>()

const onAttendClick = () => {
  if (useAuthStore().isAuthenticated) {
    useEventStore().actionAttendEvent(props.event.id, 'test', false)
  } else {
    useAuthDialog().openLoginDialog()
  }
}
</script>

<template>
  <q-page-sticky v-if="event" expand position="bottom" :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2']">
    <div class="col row q-pa-md">
      <div class="col q-px-md">
        <div class="text-body2 text-bold">{{ formatDate(event.startDate) }}</div>
        <div class="text-h6 text-bold">{{ event.name }}</div>
      </div>
      <div class="row q-gutter-md">
        <div>
<!--          <div class="text-body2 text-bold">Places Left: 123</div>-->
          <!--        <p>Price: ${{ event.price.toFixed(2) }}</p>-->
<!--          <div class="text-h6">Price: $234</div>-->
        </div>

        <div class="row items-start">
          <ShareComponent class="q-mr-md"/>
          <q-btn label="Attend" color="primary" @click="onAttendClick"/>
        </div>
      </div>
    </div>
  </q-page-sticky>
</template>

<style scoped lang="scss">

</style>
