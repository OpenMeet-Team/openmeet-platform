import { defineStore } from 'pinia'
import { groupsApi, eventsApi } from 'src/api'
import { categoriesApi } from 'src/api/categories'
import { subcategoriesApi } from 'src/api/subcategories'
import { CategoryEntity, EventEntity, GroupEntity, SubCategoryEntity } from 'src/types'

export const useHomeStore = defineStore('home', {
  state: () => ({
    // Non authorized store
    guestFeaturedGroups: <null | GroupEntity[]>(null),
    guestUpcomingEvents: <null | EventEntity[]>(null),
    guestCategories: <null | CategoryEntity[]>(null),
    guestInterests: <null | SubCategoryEntity[]>(null),
    // User home store
    userOrganizedGroups: <null | GroupEntity[]>(null),
    userNextHostedEvent: <null | EventEntity>(null),
    userRecentEventDrafts: <null | EventEntity[]>(null),
    userUpcomingEvents: <null | EventEntity[]>(null),
    userMemberGroups: <null | GroupEntity[]>(null),
    userInterests: <null | SubCategoryEntity[]>(null)
  }),
  actions: {
    async actionGetUserHomeState () {
      // Fetch data and update state
      groupsApi.getAll({}).then(res => {
        this.userOrganizedGroups = res.data.data
        this.userOrganizedGroups = res.data.data
        this.userMemberGroups = res.data.data
      })

      eventsApi.getAll({}).then(res => {
        this.userNextHostedEvent = res.data.data[0]
        this.userRecentEventDrafts = res.data.data
        this.userUpcomingEvents = res.data.data
      })
    },
    async actionGetGuestHomeState () {
      // Fetch data and update state
      groupsApi.getAll({}).then(res => {
        this.guestFeaturedGroups = res.data.data
      })

      eventsApi.getAll({}).then(res => {
        this.guestUpcomingEvents = res.data.data
      })

      categoriesApi.getAll().then(res => {
        this.guestCategories = res.data
      })

      subcategoriesApi.getAll().then(res => {
        this.guestInterests = res.data
      })
    }
    // Add other actions as needed
  }
})
