import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
// roleStore.hasPermission(Permissions.CREATE_EVENT)
// roleStore.hasGroupPermission(groupId, 'can_post_files')
export const useUserStore = defineStore('user', {
  state: () => ({
    groupRole: null as string | null,
    groupPermissions: [] as string[] // Group permissions
  }),

  getters: {

    hasGroupRole: (state) => {
      return (role: string) => state.groupRole === role
    },

    hasGroupPermission: (state) => {
      return (permission: string) => state.groupPermissions.includes(permission)
    }
  },

  actions: {
    actionGetGroupRights (groupId: string) {
      return groupsApi.roles(groupId).then(res => {
        this.actionSetGroupRole(res.data.role)
        this.actionSetGroupPermissions(res.data.permissions)
      })
    },

    actionSetGroupRole (role: string) {
      this.groupRole = role
    },

    actionSetGroupPermissions (permissions: string[]) {
      this.groupPermissions = permissions
    }
  }
})
