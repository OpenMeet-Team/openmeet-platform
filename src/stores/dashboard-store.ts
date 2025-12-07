import { defineStore } from 'pinia'
import { eventsApi } from '../api/events'
import { EventEntity } from '../types'
import { AxiosError } from 'axios'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    events: null as EventEntity[] | null,
    event: null,
    groups: null,
    group: null,
    loading: false,
    errorMessage: null as string | null
  }),

  getters: {},

  actions: {
    // Centralized Axios error handler
    handleAxiosError (err: AxiosError) {
      if (err.response) {
        // Server-side errors
        switch (err.response.status) {
          case 404:
            this.errorMessage = 'Dashboard events not found.'
            break
          case 403:
            this.errorMessage = 'Access denied. You may not have permission to view dashboard events.'
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
      console.error('Dashboard store error details:', err)
    },

    async actionGetDashboardEvents () {
      this.loading = true
      this.errorMessage = null

      try {
        // Use paginated API and extract data array
        const response = await eventsApi.getDashboardEventsPaginated({ limit: 100 })
        this.events = response.data.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      } finally {
        this.loading = false
      }
    }
  }
})
