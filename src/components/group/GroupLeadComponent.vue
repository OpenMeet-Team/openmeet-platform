<script setup lang="ts">

import { getImageSrc } from '../../utils/imageUtils'
import { useGroupStore } from '../../stores/group-store'
import ShareComponent from '../../components/common/ShareComponent.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { GroupCategoryEntity, GroupPermission } from '../../types'
import { useNavigation } from '../../composables/useNavigation'
import { pluralize } from '../../utils/stringUtils'
import QRCodeComponent from '../common/QRCodeComponent.vue'
import { downloadGroupCalendar } from '../../utils/calendarUtils'
import { useQuasar } from 'quasar'

const group = computed(() => useGroupStore().group)
const router = useRouter()
const { navigateToMember } = useNavigation()
const $q = useQuasar()
const downloading = ref(false)

const downloadCalendar = async () => {
  if (!group.value) return

  try {
    downloading.value = true
    await downloadGroupCalendar(group.value.slug)
    $q.notify({
      type: 'positive',
      message: 'Group calendar download started'
    })
  } catch (error) {
    console.error('Failed to download group calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to download group calendar'
    })
  } finally {
    downloading.value = false
  }
}

// Check if current user is a member of the group
const isGroupMember = computed(() => useGroupStore().getterUserIsGroupMember())
</script>

<template>
  <div v-if="group" class="c-group-lead-component row q-col-gutter-md">
    <div class="col-12 col-sm-6">
      <q-card flat>
        <q-img :src="getImageSrc(group.image)" :ratio="16/9"/>
      </q-card>
    </div>
    <div class="col-12 col-sm-6 column">
      <q-card flat class="col column">
        <q-card-section>
          <div class="text-h4 text-bold q-py-none q-mb-md" data-cy="group-name">{{ group.name }}</div>
          <div class="row items-start no-wrap" v-if="group.location">
            <q-icon size="sm" left name="sym_r_location_on" class="text-purple-300"/>
            <div class="text-body1">{{ group.location }}</div>
          </div>
          <div class="row items-start no-wrap q-mt-xs">
            <q-icon size="sm" left name="sym_r_people" class="text-purple-300"/>
            <div class="text-body1 q-mr-sm">{{ group.groupMembersCount }} {{ pluralize(group.groupMembersCount as number, 'member') }}</div>|
            <div class="text-body1 q-ml-sm">{{ group.visibility }} group</div>
          </div>
          <div class="row items-start q-mt-xs" v-if="group.createdBy">
            <q-icon size="sm" left name="sym_r_person" class="text-purple-300"/>
            <div class="text-body1 cursor-pointer">Organized by <span class="router-link-inherit" v-if="group.createdBy" @click.stop="navigateToMember(group.createdBy)">{{ group.createdBy.name }}</span></div>
          </div>
        </q-card-section>

        <q-card-section v-if="group.categories?.length">
          <div class="text-h6">Categories</div>
          <div class="q-gutter-sm">
            <q-chip v-for="category in group.categories as GroupCategoryEntity[]" :key="category.id">
              {{ category.name }}
            </q-chip>
          </div>
        </q-card-section>

        <q-card-section class="q-py-none" v-if="useGroupStore().getterUserHasPermission(GroupPermission.ManageGroup)">
          <q-btn icon="sym_r_edit" size="md" data-cy="edit-group-button" padding="none" no-caps flat label="Edit group info" @click="router.push({ name: 'DashboardGroupPage', params: {slug: group.slug }})"/>
        </q-card-section>

        <q-space/>

        <!-- Calendar Download Section - Only for group members -->
        <q-card-section v-if="isGroupMember">
          <q-btn
            icon="sym_r_download"
            size="md"
            padding="none"
            no-caps
            flat
            label="Download group calendar"
            :loading="downloading"
            @click="downloadCalendar"
            data-cy="download-group-calendar"
            class="q-mb-sm"
          >
            <q-tooltip>Download all group events as an .ics file</q-tooltip>
          </q-btn>
        </q-card-section>

        <q-card-section>
          <ShareComponent size="md"/>
        </q-card-section>

        <q-card-section>
          <QRCodeComponent class="" />
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
