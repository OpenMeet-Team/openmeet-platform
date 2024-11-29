<template>
  <SpinnerComponent v-if="loading" />
  <q-form v-else @submit="onSubmit" class="q-gutter-md" data-cy="group-form">
    <q-input data-cy="group-name" filled v-model="group.name" label="Group Name" counter maxlength="60"
      :rules="[(val: string) => !!val || 'Group name is required']" />

    <div class="text-body1 q-mt-md">Group Description</div>

    <q-field class="q-mb-lg q-pa-none" flat :no-error-icon="true" filled ref="description"
      v-model="group.description" :rules="[val => (!!val && val !== '<br>') || 'Description is required']">
      <template #control>
        <q-editor data-cy="group-description" flat class="bg-transparent full-width"
          :style="descriptionRef && descriptionRef.hasError ? 'border-color: var(--q-negative)' : ''"
          :model-value="group.description as string" @update:model-value="onDescriptionInput" :dense="Screen.lt.md"
          :toolbar="[
            ['bold', 'italic'],
            ['link', 'custom_btn'],
            ['unordered', 'ordered'],
            ['undo', 'redo'],
          ]" />
      </template>
    </q-field>

    <q-select data-cy="group-categories" v-model="group.categories" :options="categoryOptions" filled multiple use-chips
      emit-value map-options option-value="id" option-label="name" label="Categories (press Enter after each)" />

    <LocationComponent data-cy="group-location" :location="group.location as string" :lat="group.lat as number"
      :lon="group.lon as number" @update:model-value="onUpdateLocation" label="Group Address or location"
      placeholder="Neighborhood, city or zip" />

    <UploadComponent label="Group image" :crop-options="{ autoZoom: true, aspectRatio: 16 / 9 }"
      @upload="onGroupImageSelect" />

    <q-img ratio="16/9" v-if="group && group.image && group.image.path" :src="group.image.path" spinner-color="white"
      class="rounded-borders" style="height: 120px; max-width: 220px" />

    <q-select data-cy="group-visibility" v-model="group.visibility" label="Group Viewable By" option-value="value"
      option-label="label" emit-value map-options :options="[
        { label: 'The World', value: 'public' },
        { label: 'Authenticated Users', value: 'authenticated' },
        { label: 'People You Invite', value: 'private' }
      ]" filled />
    <div>
      <p v-if="group.visibility === GroupVisibility.Private">Require approval for new group members. Not found in search and membership availabe only with group invite. </p>
      <p v-if="group.visibility === GroupVisibility.Authenticated">Members must be authenticated. Found in search for authenticated users and can be joined by anyone with the link.</p>
      <p v-if="group.visibility === GroupVisibility.Public">Everyone can join. Found in search.</p>
    </div>

    <q-toggle :value="true" v-model="group.requireApproval">Require approval for new group members</q-toggle>

    <div class="row justify-end q-gutter-sm">
      <q-btn data-cy="group-cancel" flat label="Cancel" no-caps @click="$emit('close')" />
      <q-btn data-cy="group-update" v-if="group.id" no-caps label="Update Group" type="submit" color="primary" />
      <q-btn data-cy="group-create" v-else no-caps label="Create Group" type="submit" color="primary" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, FileEntity, GroupEntity, GroupStatus, GroupVisibility } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { groupsApi } from 'src/api/groups.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import LocationComponent from 'components/common/LocationComponent.vue'
import { Loading, LoadingBar, QField, Screen } from 'quasar'
import DOMPurify from 'dompurify'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import analyticsService from 'src/services/analyticsService'
import { useNavigation } from 'src/composables/useNavigation'

const group = ref<GroupEntity>({
  ulid: '',
  id: 0,
  name: '',
  slug: '',
  description: '',
  categories: [],
  location: '',
  requireApproval: true,
  status: GroupStatus.Draft,
  visibility: GroupVisibility.Private
})

const loading = ref(false)
const descriptionRef = ref<QField | null>(null)

const onUpdateLocation = (address: { lat: string, lon: string, location: string }) => {
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
const { navigateToGroup } = useNavigation()

onMounted(async () => {
  try {
    LoadingBar.start()
    loading.value = true

    // Fetch categories
    const categoryPromise = categoriesApi.getAll().then(res => {
      categoryOptions.value = res.data
    })

    // Fetch group data conditionally if `editGroupId` exists
    let groupPromise
    if (props.editGroupSlug) {
      groupPromise = groupsApi.getMeBySlug(props.editGroupSlug).then(res => {
        group.value = res.data
      })
    }

    // Wait for all promises to resolve, including the optional group fetch
    await Promise.all([categoryPromise, groupPromise])
  } catch (error) {
    // Handle error (optional)
    console.error('An error occurred:', error)
  } finally {
    // Stop the loading bar and reset loading state
    LoadingBar.stop()
    loading.value = false
  }
})

interface Props {
  editGroupSlug?: string
}

const props = withDefaults(defineProps<Props>(), {
  editGroupSlug: undefined
})

const onSubmit = async () => {
  group.value.status = GroupStatus.Published
  const groupPayload = {
    ...group.value
  }

  if (groupPayload.categories) {
    groupPayload.categories = groupPayload.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  Loading.show()
  try {
    if (groupPayload.ulid) {
      const res = await groupsApi.update(groupPayload.ulid, groupPayload)
      emit('updated', res.data)
      navigateToGroup(res.data)
      analyticsService.trackEvent('group_updated', { group_id: res.data.id, name: res.data.name })
    } else {
      const res = await groupsApi.create(groupPayload)
      navigateToGroup(res.data)
      emit('created', res.data)
      analyticsService.trackEvent('group_created', { group_id: res.data.id, name: res.data.name })
    }
  } catch (err) {
    console.log(err)
    error('Failed to create a group')
  } finally {
    Loading.hide()
  }
}

</script>

<style scoped lang="scss"></style>
