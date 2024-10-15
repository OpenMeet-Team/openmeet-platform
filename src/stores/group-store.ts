import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
import { GroupEntity, GroupMemberEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
const { error } = useNotification()
export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null
  }),

  getters: {
    getterHasUserGroupRole: (state) => () => {
      return state.group?.userGroupRole
    },
    getterUserGroupRole: (state) => (role: string) => {
      return state.group && role
      // return state.group?.userGroupRole?.name === role
    },
    getterUserGroupPermission: (state) => (permission: string) => {
      // return state.group?.userGroupRole?.permissions?.includes(permission) || false
      return state.group && permission
    }
  },

  actions: {
    async actionGetGroupById (id: string) {
      try {
        const res = await groupsApi.getById(id)
        this.group = res.data
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
        }
      } catch (err) {
        console.log(err)
        error('Failed to join group')
      }
    },

    async actionLeaveGroup (userId: string) {
      try {
        await groupsApi.leave(userId)
        if (this.group) {
          this.group.groupMembers = this.group.groupMembers?.filter(
            (member: GroupMemberEntity) => member.user.id !== userId
          )
        }
      } catch (err) {
        console.log(err)
        error('Failed to leave group')
      }
    }
  }
})
