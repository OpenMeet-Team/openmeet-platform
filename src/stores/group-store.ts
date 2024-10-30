import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
import { GroupEntity, GroupMemberEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import analyticsService from 'src/services/analyticsService'
const { error } = useNotification()
export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null,
    groupMembers: null as GroupMemberEntity[] | null
  }),

  getters: {
    getterGroupHasGroupMember: (state) => (): GroupMemberEntity | undefined => {
      return state.group?.groupMember
    },
    getterUserGroupRole: (state) => (role: string) => {
      return state.group?.groupMember?.groupRole?.name === role
      // return state.group?.userGroupRole?.name === role
    },
    getterUserGroupPermission: (state) => (permission: string) => {
      // return state.group?.userGroupRole?.permissions?.includes(permission) || false
      return state.group && permission
    }
  },

  actions: {
    async actionGetGroup (id: string) {
      try {
        const res = await groupsApi.getById(id)
        this.group = res.data
      } catch (err) {
        console.log(err)
        error('Failed to fetch group data')
      }
    },
    async actionGetGroupMembers (id: string) {
      try {
        const res = await groupsApi.getMembers(id)
        if (this.group) {
          this.group.groupMembers = res.data
        }
      } catch (err) {
        console.log(err)
        error('Failed to fetch group data')
      }
    },
    async actionGetGroupEvents (id: string) {
      try {
        const res = await groupsApi.getEvents(id)
        if (this.group) {
          this.group.events = res.data
        }
      } catch (err) {
        console.log(err)
        error('Failed to fetch group data')
      }
    },
    async actionGetGroupDiscussions (id: string) {
      try {
        const res = await groupsApi.getDiscussions(id)
        if (this.group) {
          this.group.discussions = res.data
        }
      } catch (err) {
        console.log(err)
        error('Failed to fetch group data')
      }
    },

    async actionJoinGroup (id: string) {
      try {
        const res = await groupsApi.join(id)
        if (this.group) {
          this.group.groupMembers = this.group.groupMembers ? [...this.group.groupMembers, res.data] : [res.data]
          this.group.groupMember = res.data
        }
        analyticsService.trackEvent('group_joined', { group_id: this.group?.id, name: this.group?.name })
      } catch (err) {
        console.log(err)
        error('Failed to join group')
      }
    },

    async actionLeaveGroup (groupId: string) {
      try {
        await groupsApi.leave(groupId)
        if (this.group) {
          this.group.groupMember = undefined
          analyticsService.trackEvent('group_left', { group_id: this.group?.id, name: this.group?.name })
        }
      } catch (err) {
        console.log(err)
        error('Failed to leave group')
      }
    }
  }
})
