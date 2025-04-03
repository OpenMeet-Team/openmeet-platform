import { eventSeriesApi, CreateEventSeriesDto, UpdateEventSeriesDto, EventSeriesEntity, EventOccurrence } from '../api/event-series'
import { EventEntity } from '../types'

export class EventSeriesService {
  /**
   * Creates a new event series
   */
  static async create (seriesData: CreateEventSeriesDto): Promise<EventSeriesEntity> {
    try {
      console.log('Creating event series with data:', seriesData)
      const response = await eventSeriesApi.create(seriesData)
      console.log('Event series created successfully:', response.data)
      return response.data
    } catch (error) {
      console.error('Error creating event series:', error)
      throw error
    }
  }

  /**
   * Updates an event series
   */
  static async update (slug: string, updateData: UpdateEventSeriesDto): Promise<EventSeriesEntity> {
    try {
      console.log('Updating event series with data:', updateData)
      const response = await eventSeriesApi.update(slug, updateData)
      console.log('Event series updated successfully:', response.data)
      return response.data
    } catch (error) {
      console.error('Error updating event series:', error)
      throw error
    }
  }

  /**
   * Gets an event series by slug
   */
  static async getBySlug (slug: string): Promise<EventSeriesEntity> {
    try {
      const response = await eventSeriesApi.getBySlug(slug)
      return response.data
    } catch (error) {
      console.error('Error getting event series:', error)
      throw error
    }
  }

  /**
   * Gets all event series with pagination
   */
  static async getAll (page: number = 1, limit: number = 10): Promise<{ data: EventSeriesEntity[], meta: { total: number, page: number, limit: number } }> {
    try {
      const response = await eventSeriesApi.getAll({ page, limit })
      return response.data
    } catch (error) {
      console.error('Error getting all event series:', error)
      throw error
    }
  }

  /**
   * Gets upcoming occurrences for an event series
   */
  static async getOccurrences (slug: string, count: number = 10): Promise<EventOccurrence[]> {
    try {
      const response = await eventSeriesApi.getOccurrences(slug, count)
      return response.data
    } catch (error) {
      console.error('Error getting event series occurrences:', error)
      throw error
    }
  }

  /**
   * Gets or creates an occurrence for a specific date
   */
  static async getOccurrence (seriesSlug: string, date: string): Promise<EventEntity> {
    try {
      const response = await eventSeriesApi.getOccurrence(seriesSlug, date)
      return response.data
    } catch (error) {
      console.error('Error getting event occurrence:', error)
      throw error
    }
  }

  /**
   * Updates future occurrences from a specific date
   */
  static async updateFutureOccurrences (
    seriesSlug: string,
    fromDate: string,
    updates: UpdateEventSeriesDto
  ): Promise<{ message: string, count: number }> {
    try {
      console.log('Updating future occurrences with data:', { fromDate, updates })
      const response = await eventSeriesApi.updateFutureOccurrences(seriesSlug, fromDate, updates)
      console.log('Future occurrences updated successfully:', response.data)
      return response.data
    } catch (error) {
      console.error('Error updating future occurrences:', error)
      throw error
    }
  }

  /**
   * Deletes an event series
   */
  static async delete (slug: string): Promise<void> {
    try {
      await eventSeriesApi.delete(slug)
      console.log('Event series deleted successfully')
    } catch (error) {
      console.error('Error deleting event series:', error)
      throw error
    }
  }

  /**
   * Helper to create a new recurrence rule
   */
  static createRecurrenceRule (
    frequency: string,
    interval: number = 1,
    options: {
      count?: number,
      until?: string,
      byweekday?: string[],
      bymonthday?: number[],
      bymonth?: number[]
    } = {}
  ): {
    frequency: string,
    interval: number,
    count?: number,
    until?: string,
    byweekday?: string[],
    bymonthday?: number[],
    bymonth?: number[]
  } {
    return {
      frequency,
      interval,
      ...options
    }
  }
}

export default new EventSeriesService()
