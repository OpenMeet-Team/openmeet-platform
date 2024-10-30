import { defineStore } from 'pinia'
import { eventsApi, groupsApi, usersApi } from 'src/api'
import { EventEntity, GroupEntity, UserEntity } from 'src/types'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    user: null as UserEntity | null,
    isLoading: false,
    ownedGroups: [] as GroupEntity[],
    organizedEvents: [] as EventEntity[],
    groupMemberships: [] as GroupEntity[]
  }),

  actions: {

    // Fetch both groups and categories with proper error handling
    actionGetProfile (id: string) {
      return Promise.all([
        usersApi.getProfile(id).then(user => {
          this.user = user.data
        }),
        groupsApi.getAll({}).then(groups => {
          this.ownedGroups = groups.data.data
        }),
        eventsApi.getAll({}).then(events => {
          this.organizedEvents = events.data.data
        }),
        groupsApi.getAll({}).then(groups => {
          this.groupMemberships = groups.data.data
        })
      ]).finally(() => {
        this.isLoading = false
      })
    }
  }
})
