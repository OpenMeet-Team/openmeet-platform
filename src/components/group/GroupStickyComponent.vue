<script setup lang="ts">
import { Dark, Loading } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useGroupStore } from 'stores/group-store.ts'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { useRoute } from 'vue-router'

const { openLoginDialog } = useAuthDialog()
const route = useRoute()

const onJoinGroup = () => {
  if (useAuthStore().isAuthenticated) {
    Loading.show()
    useGroupStore().actionJoinGroup(route.params.id as string).finally(Loading.hide)
  } else {
    openLoginDialog()
  }
}

const onLeaveGroup = () => {
  Loading.show()
  useGroupStore().actionLeaveGroup(route.params.id as string).finally(Loading.hide)
}
</script>

<template>
  <div :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2', 'q-mt-lg']" style="position: sticky; top: 54px; z-index: 1001">
    <div class="row">
      <div class="col-12 col-sm-6 q-pa-sm">
        <q-tabs align="justify" no-caps narrow-indicator>
          <q-route-tab :to="{name: 'GroupPage', params: { id: route.params.id }}" label="About"/>
          <q-route-tab :to="{name: 'GroupEventsPage', params: { id: route.params.id }}" name="events" label="Events"/>
          <q-route-tab :to="{name: 'GroupMembersPage', params: { id: route.params.id }}" name="members"
                       label="Members"/>
          <q-route-tab :to="{name: 'GroupDiscussionsPage', params: { id: route.params.id }}" name="discussions"
                       label="Discussions"/>
        </q-tabs>
      </div>
      <div class="col-12 col-sm-6 q-px-lg row items-center">
        <q-btn @click="onJoinGroup" v-if="!useGroupStore().getterHasUserGroupRole()" no-caps size="md"
               label="Join this group" color="primary"/>
        <q-btn-dropdown v-else align="center" no-caps label="You're a member">
          <q-list>
            <q-separator/>
            <MenuItemComponent label="Leave this group" icon="sym_r_delete" @click="onLeaveGroup"/>
          </q-list>
        </q-btn-dropdown>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
