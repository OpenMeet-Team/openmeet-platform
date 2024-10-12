<template>
  <q-form ref="formRef" @submit="onSubmit" class="q-gutter-md">

    <q-input
      v-model="eventData.name"
      label="Event Title"
      filled
      :rules="[(val: string) => !!val || 'Title is required']"
    />

    <!--    <div>-->
    <!--      {{ eventData.startDate }} - {{ new Date(eventData.startDate) }} - {{ new Date(eventData.startDate) > new Date() }} <br>-->
    <!--      {{ eventData.endDate }} - {{ new Date(eventData.endDate) > new Date(eventData.startDate) }} <br>-->
    <!--    </div>-->

    <DatetimeComponent required label="Starting date and time" v-model="eventData.startDate" reactive-rules
                       :rules="[(val: string) => !!val || 'Date is required']">
      <!-- (val: string) => (new Date(val) > new Date()) || 'Start date cannot be in the past.' -->
      <!-- Display Timezone -->
      <template v-slot:after>
        <div class="text-overline text-bold">
          {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
        </div>
      </template>
    </DatetimeComponent>
    <template v-if="eventData.startDate">
      <q-checkbox :model-value="!!eventData.endDate"
                  @update:model-value="eventData.endDate = $event ? eventData.startDate : ''"
                  label="Set en end time..."/>
      <DatetimeComponent v-if="eventData.endDate" label="Ending date and time" v-model="eventData.endDate"
                         reactive-rules
                         :rules="[(val: string) => !!val || 'Date is required']">
        <!-- (val: string) => (new Date(val) > new Date(eventData.startDate)) || 'End date must be later than the start date.' -->
        <template v-slot:hint>
          <div class=" text-bold">
            {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
          </div>
        </template>
      </DatetimeComponent>
    </template>

    <UploadComponent label="Event image" @upload="onEventImageSelect"/>

    <q-img
      v-if="eventData && eventData.image"
      :src="typeof eventData.image === 'object' ? eventData.image.path : eventData.image"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

    <q-input
      v-model="eventData.description"
      label="Event Description"
      type="textarea"
      filled
      :rules="[(val: string) => !!val || 'Description is required']"
    />

    <!--    <div class="text-h6 q-mt-lg">Event Description</div>-->
    <!--    <q-editor-->
    <!--      :rules="[(val: string) => !!val || 'Description is required']"-->
    <!--      filled-->
    <!--      :style="Dark.isActive ? 'background-color: rgba(255, 255, 255, 0.07)' : 'background-color: rgba(0, 0, 0, 0.05)'"-->
    <!--      v-model="eventData.description as string"-->
    <!--      :dense="Screen.lt.md"-->
    <!--      :toolbar="[-->
    <!--        ['bold', 'italic'],-->
    <!--        ['link', 'custom_btn'],-->
    <!--        ['unordered', 'ordered'],-->
    <!--        ['undo', 'redo'],-->
    <!--      ]"-->
    <!--    />-->

      <q-tabs v-model="eventData.type" align="left" indicator-color="primary">
        <q-tab label="In person" icon="sym_r_person_pin_circle" name="in-person"/>
        <q-tab label="Online" name="online" icon="sym_r_videocam"/>
        <q-tab label="Hybrid" name="hybrid" icon="sym_r_diversity_2"/>
      </q-tabs>
      <q-input v-if="eventData.type && ['online', 'hybrid'].includes(eventData.type)" filled
               v-model="eventData.locationOnline" type="url" label="Link to the event"/>
      <LocationComponent :location="eventData.location as string" :lat="eventData.lat as number" :lon="eventData.lon as number" v-if="eventData.type && ['in-person', 'hybrid'].includes(eventData.type)" @update:model-value="onUpdateLocation"
                         label="Address or location"/>

    <q-select
      v-model="eventData.categories"
      :options="categoryOptions"
      filled
      multiple
      use-chips
      option-value="id"
      option-label="name"
      label="Event Category"
    />

    <q-select
      v-model="eventData.visibility"
      label="Event Viewable By"
      option-value="value"
      option-label="label"
      emit-value
      map-options
      :options="[
          { label: 'The World', value: 'public' },
          { label: 'Authenticated Users', value: 'authenticated' },
          { label: 'People You Invite', value: 'private' }
      ]"
      filled
    />

    <q-checkbox :model-value="!!eventData.maxAttendees" @update:model-value="eventData.maxAttendees = Number($event)"
                label="Limit number of members?"/>
    <q-input
      v-if="eventData.maxAttendees"
      v-model.number="eventData.maxAttendees"
      label="Maximum Attendees"
      filled
      type="number"
      :rules="[
          (val: number) => val > 0 || 'Maximum attendees must be greater than 0',
        ]"
    />

    <div class="row justify-end q-gutter-md">
      <q-btn flat label="Cancel" @click="$emit('close')"/>
      <q-btn label="Save as draft" v-if="!eventData.status || eventData.status !== 'published'" color="secondary" @click="onSaveDraft"/>
      <q-btn label="Publish" color="primary" @click="onPublish"/>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, EventEntity, UploadedFileEntity } from 'src/types'
import LocationComponent from 'components/common/LocationComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import { eventsApi } from 'src/api/events.ts'
import DatetimeComponent from 'components/common/DatetimeComponent.vue'
import { categoriesApi } from 'src/api/categories.ts'
import { getHumanReadableDateDifference } from 'src/utils/dateUtils'
import { QForm } from 'quasar'

const { error } = useNotification()
const onEventImageSelect = (file: UploadedFileEntity) => {
  eventData.value.image = file
}

const categoryOptions = ref<CategoryEntity[]>([])

const emit = defineEmits(['created', 'updated', 'close'])
const formRef = ref<QForm | null>(null)

const eventData = ref<EventEntity>({
  name: '',
  description: '',
  startDate: '',
  id: 0,
  type: 'in-person',
  maxAttendees: 0,
  visibility: 'public',
  categories: []
})

const onSaveDraft = () => {
  eventData.value.status = 'draft'
  formRef.value?.submit()
}

const onPublish = () => {
  eventData.value.status = 'published'
  formRef.value?.submit()
}

const onUpdateLocation = (address: {lat: string, lon: string, location: string}) => {
  eventData.value.lat = parseFloat(address.lat as string)
  eventData.value.lon = parseFloat(address.lon as string)
  eventData.value.location = address.location
}

onMounted(() => {
  categoriesApi.getAll().then(res => {
    categoryOptions.value = res.data
  })
  if (props.editEventId) {
    eventsApi.getById(props.editEventId).then(res => {
      eventData.value = res.data
    })
  }
})

const props = withDefaults(defineProps<{ editEventId?: string }>(), {
  editEventId: undefined
})

const onSubmit = async () => {
  const event = {
    ...eventData.value
  }

  if (eventData.value.categories) {
    event.categories = eventData.value.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  try {
    if (event.id) {
      const res = await eventsApi.update(event.id, event)
      emit('updated', res.data)
    } else {
      const res = await eventsApi.create(event)
      emit('created', res.data)
    }
  } catch (err) {
    console.log(err)
    error('Failed to create an event')
  }
}
</script>
