import { describe, it, expect } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'

describe('EDT Timezone Test', () => {
  it('properly converts EDT time (1:15 PM) to UTC', () => {
    // Test case for EDT timezone (America/New_York)
    // When a user selects 1:15 PM EDT, it should store as 5:15 PM UTC
    const edtTimezone = 'America/New_York'

    // Set environment to be consistent for testing
    const originalEnv = process.env.TZ
    process.env.TZ = 'America/New_York' // Force EDT timezone for this test

    // Step 1: User selects date "May, 8 2025" and time "1:15 PM"
    const dateOnly = '2025-05-08'
    const timeOnly = '13:15:00' // 1:15 PM
    const localTimeStr = `${dateOnly}T${timeOnly}`
    console.log('Local EDT time input:', localTimeStr)

    // Step 2: Use our fix approach from EventFormBasicComponent:
    const formattedWithTimezone = formatInTimeZone(
      new Date(localTimeStr),
      edtTimezone,
      "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
    )
    console.log('After formatting with EDT timezone offset:', formattedWithTimezone)

    // Step 3: Parse back to get UTC (this is what would be stored in DB)
    const utcDateForStorage = new Date(formattedWithTimezone)
    const utcIsoForStorage = utcDateForStorage.toISOString()
    console.log('UTC time to store in database:', utcIsoForStorage)

    // VERIFY: The time stored in DB should be 5:15 PM UTC on May 8
    // (EDT is UTC-4, so 1:15 PM EDT = 5:15 PM UTC)
    expect(utcIsoForStorage).toBe('2025-05-08T17:15:00.000Z')
    expect(utcDateForStorage.getUTCHours()).toBe(17)
    expect(utcDateForStorage.getUTCMinutes()).toBe(15)

    // Restore the original timezone setting
    process.env.TZ = originalEnv
  })
})
