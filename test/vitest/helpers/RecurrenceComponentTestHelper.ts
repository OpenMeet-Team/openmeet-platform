import { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { RecurrenceRule } from '../../../src/types/event'

/**
 * Helper class for testing RecurrenceComponent
 * Provides methods for interacting with the component in a standardized way
 */
export class RecurrenceComponentTestHelper {
  constructor(private wrapper: VueWrapper) {}

  /**
   * Get the current frequency selected in the component
   */
  getFrequency(): string | undefined {
    return this.wrapper.vm.frequency
  }

  /**
   * Set the frequency through the UI
   * @param frequency The frequency to set ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')
   */
  async setFrequency(frequency: string): Promise<void> {
    // Set via v-model directly for stub components
    this.wrapper.vm.frequency = frequency
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current interval
   */
  getInterval(): number {
    return this.wrapper.vm.interval
  }

  /**
   * Set the interval through the UI
   * @param interval The interval to set (e.g., every 2 weeks)
   */
  async setInterval(interval: number): Promise<void> {
    this.wrapper.vm.interval = interval
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the selected days for weekly recurrence
   */
  getSelectedDays(): string[] {
    return this.wrapper.vm.selectedDays
  }

  /**
   * Toggle a specific day in weekly frequency
   * @param day The day to toggle ('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA')
   */
  async toggleDay(day: string): Promise<void> {
    this.wrapper.vm.toggleDay(day)
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Set specific days for weekly frequency
   * @param days Array of days to set ('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA')
   */
  async setSelectedDays(days: string[]): Promise<void> {
    // Clear current selections
    const currentDays = [...this.wrapper.vm.selectedDays]
    for (const day of currentDays) {
      await this.toggleDay(day)
    }
    
    // Set new selections
    for (const day of days) {
      await this.toggleDay(day)
    }
    
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current monthly repeat type
   */
  getMonthlyRepeatType(): string {
    return this.wrapper.vm.monthlyRepeatType
  }

  /**
   * Set the monthly repeat type (dayOfMonth or dayOfWeek)
   * @param type The repeat type ('dayOfMonth' or 'dayOfWeek')
   */
  async setMonthlyRepeatType(type: 'dayOfMonth' | 'dayOfWeek'): Promise<void> {
    this.wrapper.vm.monthlyRepeatType = type
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current monthly position (for dayOfWeek type)
   */
  getMonthlyPosition(): string {
    return this.wrapper.vm.monthlyPosition
  }

  /**
   * Set the monthly position (for 'First Tuesday', 'Second Wednesday', etc.)
   * @param position The position to set ('1', '2', '3', '4', '-1' for last)
   */
  async setMonthlyPosition(position: string): Promise<void> {
    this.wrapper.vm.monthlyPosition = position
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current monthly weekday (for dayOfWeek type)
   */
  getMonthlyWeekday(): string {
    return this.wrapper.vm.monthlyWeekday
  }

  /**
   * Set the monthly weekday (for 'First Tuesday', 'Second Wednesday', etc.)
   * @param weekday The weekday to set ('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA')
   */
  async setMonthlyWeekday(weekday: string): Promise<void> {
    this.wrapper.vm.monthlyWeekday = weekday
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Set both position and weekday for monthly recurrence
   * @param position The position ('1', '2', '3', '4', '-1')
   * @param weekday The weekday ('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA')
   */
  async setMonthlyPattern(position: string, weekday: string): Promise<void> {
    await this.setMonthlyRepeatType('dayOfWeek')
    await this.setMonthlyPosition(position)
    await this.setMonthlyWeekday(weekday)
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get current timezone
   */
  getTimezone(): string {
    return this.wrapper.vm.timezone
  }

  /**
   * Set the timezone
   * @param timezone The timezone to set (e.g., 'America/New_York')
   */
  async setTimezone(timezone: string): Promise<void> {
    this.wrapper.vm.timezone = timezone
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current end type
   */
  getEndType(): string {
    return this.wrapper.vm.endType
  }

  /**
   * Set the end type (never, count, or until)
   * @param type The end type ('never', 'count', or 'until')
   */
  async setEndType(type: 'never' | 'count' | 'until'): Promise<void> {
    this.wrapper.vm.endType = type
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current count value
   */
  getCount(): number {
    return this.wrapper.vm.count
  }

  /**
   * Set the count (for 'After X occurrences')
   * @param count The number of occurrences
   */
  async setCount(count: number): Promise<void> {
    await this.setEndType('count')
    this.wrapper.vm.count = count
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current until date
   */
  getUntil(): string {
    return this.wrapper.vm.until
  }

  /**
   * Set the until date (for 'Ends on date')
   * @param date The date string (YYYY-MM-DD)
   */
  async setUntil(date: string): Promise<void> {
    await this.setEndType('until')
    this.wrapper.vm.until = date
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Get the current pattern human-readable description
   */
  getPatternDescription(): string {
    return this.wrapper.vm.humanReadablePattern
  }

  /**
   * Get the current occurrences
   */
  getOccurrences(): Date[] {
    return this.wrapper.vm.occurrences
  }

  /**
   * Get the current recurrence rule
   */
  getRule(): Partial<RecurrenceRule> | undefined {
    return this.wrapper.vm.rule
  }

  /**
   * Toggle recurrence on/off
   * @param value Whether to enable recurrence
   */
  async toggleRecurrence(value: boolean): Promise<void> {
    this.wrapper.vm.toggleRecurrence(value)
    await nextTick()
    await this.waitForProcessing()
  }

  /**
   * Wait for component processing to complete
   */
  async waitForProcessing(): Promise<void> {
    // Wait for the component to finish calculating
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Wait for next tick to ensure Vue updates
    await nextTick()
    
    // Wait for any debounce timers
    await new Promise(resolve => setTimeout(resolve, 750))
    
    // Final nextTick to ensure everything is rendered
    await nextTick()
  }

  /**
   * Check if all occurrences fall on a specific day of week
   * @param dayName The day name to check ('Monday', 'Tuesday', etc.)
   * @param timezone The timezone to use for the check
   */
  occurrencesMatchDay(dayName: string, timezone: string): boolean {
    const { formatInTimeZone } = require('date-fns-tz')
    const occurrences = this.getOccurrences()
    
    return occurrences.every(date => 
      formatInTimeZone(date, timezone, 'EEEE') === dayName
    )
  }

  /**
   * Log detailed information about the component state
   */
  logComponentState(): void {
    console.log('Component State:', {
      frequency: this.getFrequency(),
      interval: this.getInterval(),
      selectedDays: this.getSelectedDays(),
      monthlyRepeatType: this.getMonthlyRepeatType(),
      monthlyPosition: this.getMonthlyPosition(),
      monthlyWeekday: this.getMonthlyWeekday(),
      timezone: this.getTimezone(),
      endType: this.getEndType(),
      count: this.getCount(),
      until: this.getUntil(),
      rule: this.getRule()
    })

    console.log('Occurrences:', this.getOccurrences().map(date => date.toISOString()))
    console.log('Pattern Description:', this.getPatternDescription())
  }
}