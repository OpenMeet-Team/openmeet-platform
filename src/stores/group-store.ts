import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
import { GroupEntity } from 'src/types'

export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null
  }),

  getters: {},

  actions: {
    actionGetGroupById (id: string) {
      return groupsApi.getById(id).then(res => {
        this.group = res.data
      })
    }
  }
})
