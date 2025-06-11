<template>
  <SpinnerComponent v-if="loading" />
  <q-form v-else @submit="onSubmit" class="q-gutter-md" data-cy="group-form">
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_group" class="q-mr-sm" />
          Basic Information
        </div>

        <!-- Group Name -->
        <q-input data-cy="group-name" filled v-model="group.name" label="Group Name" counter maxlength="60"
          :rules="[(val: string) => !!val || 'Group name is required']" class="q-mb-md" />

        <!-- Group Description -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Group Description <span class="text-caption text-grey-7">(Supports Markdown)</span></div>

          <q-tabs
            v-model="descriptionTab"
            class="text-primary"
            active-color="primary"
            indicator-color="primary"
            narrow-indicator
          >
            <q-tab name="edit" label="Edit" />
            <q-tab name="preview" label="Preview" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="descriptionTab" animated>
            <q-tab-panel name="edit" class="q-pa-none">
              <q-input
                data-cy="group-description"
                filled
                type="textarea"
                v-model="group.description"
                label="Group description"
                hint="Supports Markdown formatting"
                counter
                maxlength="2000"
                autogrow
                class="q-mt-sm"
                :rules="[val => !!val || 'Description is required']"
              />
              <div class="text-caption q-mt-xs">
                <span class="text-weight-medium">Markdown tip:</span>
                Use **bold**, *italic*, [links](url), and other Markdown syntax
              </div>
            </q-tab-panel>

            <q-tab-panel name="preview" class="q-pa-none">
              <div class="q-pa-md markdown-preview rounded-borders q-mt-sm">
                <q-markdown
                  :src="group.description || '*No content yet*'"
                  class="text-body1 description-preview"
                />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>

        <!-- Group Categories -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Categories</div>
          <q-select data-cy="group-categories" v-model="group.categories" :options="categoryOptions" filled multiple use-chips
            emit-value map-options option-value="id" option-label="name" label="Categories" />
        </div>

        <!-- Group Location -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Group Location</div>
          <LocationComponent data-cy="group-location" :location="group.location as string" :lat="group.lat as number"
            :lon="group.lon as number" @update:model-value="onUpdateLocation" label="Group Address or location"
            placeholder="Enter address or location" />
        </div>

        <!-- Group Image -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Group Image</div>

          <div class="row items-center q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <UploadComponent label="Group image" :crop-options="{ autoZoom: true, aspectRatio: 16 / 9 }"
                @upload="onGroupImageSelect" />
            </div>

            <div class="col-12 col-sm-6" v-if="group && group.image && group.image.path">
              <q-img ratio="3/2" :src="group.image.path" spinner-color="white"
                class="rounded-borders" style="height: 120px; max-width: 180px" />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Group Settings -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_settings" class="q-mr-sm" />
          Group Settings
        </div>

        <!-- Group Visibility -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Visibility</div>
          <q-select data-cy="group-visibility" v-model="group.visibility" label="Group Viewable By" option-value="value"
            option-label="label" emit-value map-options :options="[
              { label: 'The World', value: 'public' },
              { label: 'Authenticated Users', value: 'authenticated' },
              { label: 'Private Group', value: 'private' }
            ]" filled />
          <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Private">
            Only invited members can view and join this group. Not found in search and membership available only with group invite.
          </p>
          <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Authenticated">
            Only logged-in users can view and join. Found in search for authenticated users.
          </p>
          <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Public">
            Anyone can view and join this group. Found in search.
          </p>
        </div>

        <!-- Membership Approval -->
        <q-separator spaced />
        <div class="text-subtitle2 q-my-sm">Membership Settings</div>

        <q-toggle :value="true" v-model="group.requireApproval">Require approval for new group members</q-toggle>
      </q-card-section>
    </q-card>

    <div class="row justify-end q-gutter-sm">
      <q-btn data-cy="group-cancel" flat label="Cancel" no-caps @click="$emit('close')" />
      <q-btn data-cy="group-update" v-if="group.id" no-caps label="Update Group" type="submit" color="primary" />
      <q-btn data-cy="group-create" v-else no-caps label="Create Group" type="submit" color="primary" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, FileEntity, GroupEntity, GroupStatus, GroupVisibility } from '../../types'
import { useNotification } from '../../composables/useNotification'
import { categoriesApi } from '../../api/categories'
import { groupsApi } from '../../api/groups'
import UploadComponent from '../../components/common/UploadComponent.vue'
import LocationComponent from '../../components/common/LocationComponent.vue'
import { Loading, LoadingBar } from 'quasar'
// DOMPurify import removed
import SpinnerComponent from '../common/SpinnerComponent.vue'
import analyticsService from '../../services/analyticsService'
import { useNavigation } from '../../composables/useNavigation'

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

const onUpdateLocation = (address: { lat: string, lon: string, location: string }) => {
  group.value.lat = parseFloat(address.lat as string)
  group.value.lon = parseFloat(address.lon as string)
  group.value.location = address.location
}

const onGroupImageSelect = (file: FileEntity) => {
  group.value.image = file
}

// No longer need the description input handler for HTML sanitization with Markdown
// Markdown content will be sanitized server-side

// Tab for description editor (edit/preview)
const descriptionTab = ref('edit')

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
      groupPromise = groupsApi.getDashboardGroup(props.editGroupSlug).then(res => {
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
    if (groupPayload.slug) {
      const res = await groupsApi.update(groupPayload.slug, groupPayload)
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

<style scoped lang="scss">
.markdown-preview {
  min-height: 100px;
  max-height: 400px;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.02);
}

.description-preview {
  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}
</style>
