import { eventSeriesApi, CreateEventSeriesDto, UpdateEventSeriesDto } from '../api/event-series'
import { EventEntity } from '../types'
import { EventSeriesEntity, EventOccurrence } from '../types/event-series'
import { eventsApi } from '../api/events'

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
      console.log('Updating event series with data:', JSON.stringify(updateData, null, 2))

      // Specific logging for recurrence rule to ensure bysetpos is preserved
      if (updateData.recurrenceRule) {
        console.log('Recurrence rule details:', {
          frequency: updateData.recurrenceRule.frequency,
          interval: updateData.recurrenceRule.interval,
          byweekday: updateData.recurrenceRule.byweekday,
          bymonthday: updateData.recurrenceRule.bymonthday,
          bysetpos: updateData.recurrenceRule.bysetpos,
          bymonth: updateData.recurrenceRule.bymonth
        })

        // Specific check for monthly + weekday pattern missing bysetpos
        if (updateData.recurrenceRule.frequency === 'MONTHLY' &&
            updateData.recurrenceRule.byweekday &&
            !updateData.recurrenceRule.bysetpos) {
          console.warn('WARNING: Monthly recurrence with byweekday but no bysetpos - this will create a weekly pattern!')
        }
      }

      const response = await eventSeriesApi.update(slug, updateData)
      console.log('Event series updated successfully:', response.data)

      // Log the returned recurrence pattern to verify it was updated correctly
      if (response.data.recurrenceRule) {
        console.log('Updated recurrence rule returned from API:',
          JSON.stringify(response.data.recurrenceRule, null, 2))
      }

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

      // Generate a human-readable description for the recurrence rule if it's a monthly pattern
      if (response.data.recurrenceRule &&
          response.data.recurrenceRule.frequency === 'MONTHLY' &&
          response.data.recurrenceRule.byweekday &&
          response.data.recurrenceRule.bysetpos) {
        // If we have recurrence rule but no description or incorrect one, add it
        if (!response.data.recurrenceDescription ||
            !response.data.recurrenceDescription.includes(String(response.data.recurrenceRule.bysetpos[0]))) {
          console.log('Creating accurate description for monthly pattern with bysetpos')

          const { RecurrenceService } = await import('../services/recurrenceService')

          // Generate the description from scratch
          const weekdayOptions = RecurrenceService.weekdayOptions
          const weekday = response.data.recurrenceRule.byweekday[0]
          const position = response.data.recurrenceRule.bysetpos[0]

          // Create a position string (1st, 2nd, 3rd, etc.)
          let positionStr = String(position)
          if (position === -1) {
            positionStr = 'last'
          } else if (position === 1) {
            positionStr = '1st'
          } else if (position === 2) {
            positionStr = '2nd'
          } else if (position === 3) {
            positionStr = '3rd'
          } else {
            positionStr = `${position}th`
          }

          // Get weekday label
          const weekdayLabel = weekdayOptions.find(w => w.value === weekday)?.label || weekday

          // Create the full description
          response.data.recurrenceDescription = `Monthly on the ${positionStr} ${weekdayLabel}${
            response.data.recurrenceRule.interval > 1
            ? ` every ${response.data.recurrenceRule.interval} months`
            : ''
          }`

          console.log('Generated accurate recurrence description:', response.data.recurrenceDescription)
        }
      }

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
      const response = await eventSeriesApi.getAll({ params: { page, limit } })
      return response.data
    } catch (error) {
      console.error('Error getting all event series:', error)
      throw error
    }
  }

  /**
   * Gets upcoming occurrences for an event series
   */
  static async getOccurrences (slug: string, count: number = 10, includePast: boolean = false): Promise<EventOccurrence[]> {
    try {
      console.log(`EventSeriesService.getOccurrences - Fetching occurrences for series ${slug}`)
      const response = await eventSeriesApi.getOccurrences(slug, count, includePast)

      // Log occurrences for debugging
      console.log(`EventSeriesService.getOccurrences - Got ${response.data.length} occurrences for series ${slug}`)
      console.log('First 3 occurrences:', response.data.slice(0, 3).map(occ => ({
        date: occ.date,
        materialized: occ.materialized,
        eventSlug: occ.event?.slug || 'none'
      })))

      // Check if the dates appear to be weekly or monthly
      if (response.data.length >= 2) {
        const date1 = new Date(response.data[0].date)
        const date2 = new Date(response.data[1].date)
        const diffDays = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
        console.log(`EventSeriesService.getOccurrences - Days between first two occurrences: ${diffDays}`)
        console.log(`Pattern appears to be: ${diffDays < 10 ? 'WEEKLY' : 'MONTHLY'}`)
      }

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async delete (slug: string, _deleteEvents: boolean = false): Promise<void> {
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

  /**
   * Gets all events that belong to a specific series by slug
   */
  static async getEventsBySeriesSlug (slug: string, options?: { page: number, limit: number }): Promise<EventEntity[]> {
    try {
      console.log(`Getting all events for series ${slug}`)
      const response = await eventsApi.getEventsBySeries(slug, options)
      console.log(`Found ${response.data.length} events for series ${slug}`)
      return response.data
    } catch (error) {
      console.error('Error getting events for series:', error)
      return [] // Return empty array instead of throwing to avoid breaking the UI
    }
  }
}

export default new EventSeriesService()
