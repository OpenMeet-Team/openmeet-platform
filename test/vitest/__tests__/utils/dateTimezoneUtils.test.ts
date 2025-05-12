import { describe, it, expect } from 'vitest'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

describe('date-fns-tz utility functions', () => {
  // Timezone we're focusing on in the failing test
  const novosibirskTimezone = 'Asia/Novosibirsk'
  // A clear test date to work with
  const testDate = new Date('2025-05-29T16:15:00')

  describe('formatInTimeZone', () => {
    it('formats a date in the specified timezone - Novosibirsk', () => {
      // Get the local timezone representation
      const localFormat = testDate.toLocaleString('en-US', { timeZone: 'UTC' })
      console.log('Local test date (UTC):', localFormat)

      // Format in Novosibirsk timezone
      const novosibirskFormat = formatInTimeZone(testDate, novosibirskTimezone, 'yyyy-MM-dd HH:mm:ss')
      console.log('Formatted in Novosibirsk:', novosibirskFormat)

      // For debugging, show the offset
      const offset = formatInTimeZone(testDate, novosibirskTimezone, 'xxx')
      console.log('Novosibirsk offset:', offset)

      // Basic expectations
      expect(novosibirskFormat).toContain('2025-05-29')
      // The time should be UTC + Novosibirsk offset (approximately 7 hours ahead)
      // So if our test date is 16:15 UTC, it should be around 23:15 in Novosibirsk
      expect(novosibirskFormat).toContain('23:15:00')
    })

    it('formats a date in reverse - UTC to Novosibirsk wall time', () => {
      // Create a time that we want to be 16:15 in Novosibirsk
      // Since Novosibirsk is UTC+7, this should be 09:15 UTC
      const utcTime = new Date('2025-05-29T09:15:00Z')
      console.log('UTC time (should be 09:15):', utcTime.toISOString())

      // Format in Novosibirsk timezone
      const novosibirskFormat = formatInTimeZone(utcTime, novosibirskTimezone, 'yyyy-MM-dd HH:mm:ss')
      console.log('Should be 16:15 in Novosibirsk:', novosibirskFormat)

      // Check the formatting
      expect(novosibirskFormat).toContain('2025-05-29')
      expect(novosibirskFormat).toContain('16:15:00')
    })
  })

  describe('toZonedTime', () => {
    it('converts a date to the target timezone representation', () => {
      // Start with a UTC date
      const utcDate = new Date('2025-05-29T09:15:00Z')
      console.log('Original UTC date:', utcDate.toISOString())

      // Convert to Novosibirsk time
      const novosibirskDate = toZonedTime(utcDate, novosibirskTimezone)
      console.log('Novosibirsk date object:', novosibirskDate.toString())
      console.log('Novosibirsk date.toISOString():', novosibirskDate.toISOString())

      // Important: toZonedTime doesn't change the UTC time, it adjusts
      // the internal timezone offset so that local methods like toString()
      // will display the correct time for the target zone

      // The wall clock time (via toString) should show around 16:15 or 4:15 PM
      expect(novosibirskDate.toString()).toContain('16:15')

      // CORRECTION: toZonedTime doesn't change the UTC time when we call toISOString()
      // The date object still represents 16:15 in UTC
      expect(novosibirskDate.toISOString()).toContain('2025-05-29T16:15:00.000Z')
    })

    it('properly handles an Asia/Novosibirsk wall time to UTC conversion', () => {
      // This simulates creating a date with components entered in Novosibirsk local time
      // In our component, this is what we do with the date/time pickers
      const localDateComponents = new Date(2025, 4, 29, 16, 15) // May 29, 2025, 4:15 PM (local browser time)
      console.log('Local date components:', localDateComponents.toString())

      // Convert to a date representing these components in Novosibirsk
      const novosibirskTime = toZonedTime(localDateComponents, novosibirskTimezone)
      console.log('Components interpreted as Novosibirsk time:', novosibirskTime.toString())

      // When we call toISOString() on this, what do we get?
      const utcConverted = novosibirskTime.toISOString()
      console.log('UTC conversion via toISOString:', utcConverted)

      // This test demonstrates how toZonedTime + toISOString behaves when
      // trying to convert a wall time in a target timezone to UTC
    })

    it('demonstrates a complete timezone conversion workflow', () => {
      // SCENARIO: User enters May 29, 2025, 4:15 PM in Asia/Novosibirsk timezone

      // Step 1: Parse the input components (browser local time, but meaning Novosibirsk time)
      const inputComponents = new Date(2025, 4, 29, 16, 15) // May 29, 2025, 4:15 PM
      console.log('Input components as local time:', inputComponents.toString())

      // Step 2: Create a UTC ISO string with the correct timezone offset for Novosibirsk
      // First, get the timezone offset for that date
      const novosibirskOffset = formatInTimeZone(inputComponents, novosibirskTimezone, 'xxx')
      console.log('Novosibirsk offset:', novosibirskOffset)

      // Format date components into ISO format
      const year = inputComponents.getFullYear()
      const month = String(inputComponents.getMonth() + 1).padStart(2, '0')
      const day = String(inputComponents.getDate()).padStart(2, '0')
      const hours = String(inputComponents.getHours()).padStart(2, '0')
      const minutes = String(inputComponents.getMinutes()).padStart(2, '0')

      // Create ISO string with timezone offset
      const isoWithOffset = `${year}-${month}-${day}T${hours}:${minutes}:00${novosibirskOffset}`
      console.log('ISO with offset:', isoWithOffset)

      // Parse this string to get the correct UTC time
      const utcDate = new Date(isoWithOffset)
      console.log('Resulting UTC date:', utcDate.toISOString())

      // The time in UTC should be 09:15 (16:15 - 7 hours)
      expect(utcDate.getUTCHours()).toBe(9)
      expect(utcDate.getUTCMinutes()).toBe(15)
    })
  })
})
