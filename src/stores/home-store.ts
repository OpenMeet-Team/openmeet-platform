import { defineStore } from 'pinia'
import { homeApi } from '../api'
import { CategoryEntity, EventEntity, GroupEntity, SubCategoryEntity } from '../types'

export const useHomeStore = defineStore('home', {
  state: () => ({
    loading: false,
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
      this.loading = true
      // Fetch data and update state
      return homeApi.getUserHome().then(res => {
        this.userOrganizedGroups = res.data.organizedGroups
        this.userNextHostedEvent = res.data.nextHostedEvent
        this.userRecentEventDrafts = res.data.recentEventDrafts
        this.userUpcomingEvents = res.data.upcomingEvents
        this.userMemberGroups = res.data.memberGroups
        this.userInterests = res.data.interests
      }).finally(() => {
        this.loading = false
      })
    },
    async actionGetGuestHomeState () {
      this.loading = true

      return homeApi.getGuestHome().then(res => {
        this.guestFeaturedGroups = res.data.groups
        this.guestUpcomingEvents = res.data.events
        this.guestCategories = res.data.categories
        this.guestInterests = res.data.interests
      }).finally(() => {
        this.loading = false
      })
    }
  }
})
