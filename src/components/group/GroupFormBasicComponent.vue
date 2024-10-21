<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      filled
      v-model="group.name"
      label="Group Name"
      counter
      maxlength="60"
      :rules="[(val: string) => !!val || 'Group name is required']"
    />
    <!-- <q-input
      filled
      v-model="group.description"
      type="textarea"
      label="Description"
      :rules="[(val: []) => !!val || 'Description is required']"
    /> -->

    <div class="text-h6 q-mt-lg">Group Description</div>
       <q-editor
          :rules="[(val: string) => !!val || 'Description is required']"
         filled
         :style="Dark.isActive ? 'background-color: rgba(255, 255, 255, 0.07)' : 'background-color: rgba(0, 0, 0, 0.05)'"
         :model-value="group.description as string"
         @update:model-value="onDescriptionInput"
         :dense="Screen.lt.md"
         :toolbar="[
           ['bold', 'italic'],
           ['link', 'custom_btn'],
           ['unordered', 'ordered'],
           ['undo', 'redo'],
          ]"
      />

    <q-select
      :rules="[(val: []) => !!(val && val.length) || 'Category is required']"
      v-model="group.categories"
      :options="categoryOptions"
      filled
      multiple
      use-chips
      emit-value
      map-options
      option-value="id"
      option-label="name"
      label="Categories (press Enter after each)"
    />

    <LocationComponent :location="group.location as string" :lat="group.lat as number" :lon="group.lon as number" @update:model-value="onUpdateLocation" label="Group Address or location" placeholder="Neighborhood, city or zip"/>

    <UploadComponent label="Group image" :crop-options="{autoZoom: true, aspectRatio: 16/9}" @upload="onGroupImageSelect"/>

    <q-img
      v-if="group && group.image && group.image.path"
      :src="group.image.path"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

    <q-select
      v-model="group.visibility"
      label="Group Viewable By"
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

    <q-toggle :value="true" v-model="group.requireApproval">Require approval for new group members</q-toggle>

    <div class="row justify-end q-gutter-sm">
      <q-btn flat label="Cancel" @click="$emit('close')"/>
      <q-btn v-if="group.id" label="Update" type="submit" color="primary"/>
      <q-btn v-else label="Create" type="submit" color="primary"/>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, FileEntity, GroupEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { groupsApi } from 'src/api/groups.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import LocationComponent from 'components/common/LocationComponent.vue'
import { Dark, Loading, Screen } from 'quasar'
import DOMPurify from 'dompurify'

const group = ref<GroupEntity>({
  id: 0,
  name: '',
  slug: '',
  description: '',
  categories: [],
  location: '',
  requireApproval: false,
  visibility: 'public'
})

const onUpdateLocation = (address: {lat: string, lon: string, location: string}) => {
  group.value.lat = parseFloat(address.lat as string)
  group.value.lon = parseFloat(address.lon as string)
  group.value.location = address.location
}

const onGroupImageSelect = (file: FileEntity) => {
  group.value.image = file
}

const onDescriptionInput = (val: string) => {
  group.value.description = DOMPurify.sanitize(val)
}

const categoryOptions = ref<CategoryEntity[]>([])

const { error } = useNotification()

const emit = defineEmits(['created', 'updated', 'close'])

onMounted(() => {
  // TODO fetch categories
  categoriesApi.getAll().then(res => {
    categoryOptions.value = res.data
  })
  if (props.editGroupId) {
    groupsApi.getById(props.editGroupId).then(res => {
      group.value = res.data
    })
  }
})

interface Props {
  editGroupId?: string
}

const props = withDefaults(defineProps<Props>(), {
  editGroupId: undefined
})

const onSubmit = async () => {
  group.value.status = 'published'
  const groupPayload = {
    ...group.value
  }

  Loading.show()
  try {
    if (groupPayload.id) {
      const res = await groupsApi.update(groupPayload.id, groupPayload)
      emit('updated', res.data)
    } else {
      const res = await groupsApi.create(groupPayload)
      emit('created', res.data)
    }
  } catch (err) {
    console.log(err)
    error('Failed to create a group')
  } finally {
    Loading.hide()
  }
}

</script>

<style scoped lang="scss">

</style>
