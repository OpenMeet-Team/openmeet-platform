import { defineStore } from 'pinia'
import { GroupPaginationEntity } from 'src/types'
import { AxiosError } from 'axios'
import { RouteQueryAndHash } from 'vue-router'
import { groupsApi } from 'src/api/groups.ts'

export const useGroupsStore = defineStore('groups', {
  state: () => ({
    groups: null as GroupPaginationEntity | null,
    errorMessage: null as string | null,
    isLoading: false
  }),

  actions: {
    // Centralized Axios error handler
    handleAxiosError (err: AxiosError) {
      if (err.response) {
        // Server-side errors
        switch (err.response.status) {
          case 404:
            this.errorMessage = 'Group not found.'
            break
          case 403:
            this.errorMessage = 'Access denied. You may not have permission to view this group.'
            break
          case 500:
            this.errorMessage = 'Server error. Please try again later.'
            break
          default:
            this.errorMessage = 'An unexpected error occurred.'
        }
      } else if (err.request) {
        // Network errors
        this.errorMessage = 'Network error. Please check your internet connection.'
      } else {
        // Other errors (e.g., Axios configuration)
        this.errorMessage = 'An unexpected error occurred. Please try again.'
      }

      // Log the error details for debugging
      console.error('Error details:', err)
    },

    // Fetch both groups and categories with proper error handling
    async actionGetGroupsState (query: RouteQueryAndHash) {
      this.isLoading = true
      this.errorMessage = null

      try {
        // Run both actions concurrently
        await Promise.all([this.actionGetGroups(query)])
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      } finally {
        this.isLoading = false
      }
    },

    // Fetch groups based on the query
    async actionGetGroups (query: RouteQueryAndHash) {
      this.errorMessage = null

      try {
        const response = await groupsApi.getAll(query)
        this.groups = response.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      }
    }
  }
})
