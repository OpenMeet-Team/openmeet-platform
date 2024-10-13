import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
import { GroupEntity } from 'src/types'

export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null
  }),

  getters: {
    getterHasUserGroupRole: (state) => () => {
      return state.group && state.group.userGroupRole
    },
    getterUserGroupRole: (state) => (role: string) => {
      // return state.group?.user?.role === role
      return state.group && role && false // TODO
    },

    // Check if user has a specific permission in the group
    getterUserGroupPermission: (state) => (permission: string) => {
      // return state.group?.user?.permissions?.includes(permission) || false
      return state.group && permission && false // TODO
    }
  },

  actions: {
    actionGetGroupById (id: string) {
      return groupsApi.getById(id).then(res => {
        this.group = res.data
      })
    },
    actionJoinGroup (id: string) {
      return groupsApi.join(id as string).then((e) => {
        console.log(e.data)
      })
    },
    actionLeaveGroup (id: string) {
      return groupsApi.leave(id as string).then((e) => {
        console.log(e.data)
      })
    }
  }
})
