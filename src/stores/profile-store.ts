import { defineStore } from 'pinia'
import { eventsApi, groupsApi, usersApi } from 'src/api'
import { subcategoriesApi } from 'src/api/subcategories'
import { EventEntity, GroupEntity, SubCategoryEntity, UserEntity } from 'src/types'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    user: null as UserEntity | null,
    isLoading: false,
    userInterests: [] as SubCategoryEntity[],
    ownedGroups: [] as GroupEntity[],
    organizedEvents: [] as EventEntity[],
    groupMemberships: [] as GroupEntity[]
  }),

  actions: {

    // Fetch both groups and categories with proper error handling
    actionGetProfile (id: string) {
      return Promise.all([
        usersApi.getById(id).then(user => {
          this.user = user.data
        }),
        subcategoriesApi.getAll().then(subcategories => {
          this.userInterests = subcategories.data
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
