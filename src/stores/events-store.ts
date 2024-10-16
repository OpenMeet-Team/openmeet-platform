import { defineStore } from 'pinia'
import { CategoryEntity, EventPaginationEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { eventsApi } from 'src/api/events.ts'
import { AxiosError } from 'axios'
import { RouteQueryAndHash } from 'vue-router'
import { categoriesApi } from 'src/api/categories.ts'

const { error } = useNotification()

export const useEventsStore = defineStore('events', {
  state: () => ({
    events: null as EventPaginationEntity | null,
    categories: null as CategoryEntity[] | null,
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
            this.errorMessage = 'Event not found.'
            break
          case 403:
            this.errorMessage = 'Access denied. You may not have permission to view this event.'
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

    // Fetch both events and categories with proper error handling
    async actionGetEventsState (query: RouteQueryAndHash) {
      this.isLoading = true
      this.errorMessage = null

      try {
        // Run both actions concurrently
        await Promise.all([this.actionGetEvents(query), this.actionGetEventsCategories()])
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      } finally {
        this.isLoading = false
      }
    },

    // Fetch events based on the query
    async actionGetEvents (query: RouteQueryAndHash) {
      this.errorMessage = null

      try {
        const response = await eventsApi.getAll(query)
        this.events = response.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      }
    },

    // Fetch event categories
    async actionGetEventsCategories () {
      try {
        const response = await categoriesApi.getAll()
        this.categories = response.data
      } catch (err) {
        console.error('Error fetching categories:', err)
        error('Failed to fetch categories') // Use notification system
      }
    }
  }
})
