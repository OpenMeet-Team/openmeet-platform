import { api } from '../boot/axios'

export interface ConflictEvent {
  eventId: string
  title: string
  startTime: string
  endTime: string
  calendarSourceUlid: string
}

export interface CalendarSource {
  ulid: string
  type: 'google' | 'apple' | 'outlook' | 'ical'
  name: string
  url?: string
  isActive: boolean
  isPrivate: boolean
  syncFrequency: number
  lastSyncedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCalendarSourceDto {
  type: 'google' | 'apple' | 'outlook' | 'ical'
  name: string
  url?: string
  isPrivate?: boolean
  syncFrequency?: number
}

export interface UpdateCalendarSourceDto {
  name?: string
  url?: string
  isActive?: boolean
  isPrivate?: boolean
  syncFrequency?: number
}

export interface SyncResult {
  success: boolean
  eventsCount: number
  error?: string
  lastSyncedAt: string
}

export interface AvailabilityRequest {
  startTime: string
  endTime: string
  calendarSourceIds?: string[]
}

export interface AvailabilityResponse {
  available: boolean
  conflicts: string[]
  conflictingEvents: ConflictEvent[]
  message: string
}

export interface GetExternalEventsRequest {
  startTime: string
  endTime: string
  calendarSourceIds?: string[]
}

export interface ExternalEvent {
  id: string
  externalId: string
  summary: string
  description?: string
  startTime: string
  endTime: string
  isAllDay: boolean
  location?: string
  status: string
  calendarSourceId: number
}

export interface GetExternalEventsResponse {
  events: ExternalEvent[]
  totalCount: number
  dateRange: {
    startTime: string
    endTime: string
  }
}

export interface AuthorizationResponse {
  authorizationUrl: string
  state: string
}

// Calendar Source Management
export const getCalendarSources = (): Promise<{ data: CalendarSource[] }> => {
  return api.get('/api/calendar-sources')
}

export const createCalendarSource = (data: CreateCalendarSourceDto): Promise<{ data: CalendarSource }> => {
  return api.post('/api/calendar-sources', data)
}

export const getCalendarSource = (ulid: string): Promise<{ data: CalendarSource }> => {
  return api.get(`/api/calendar-sources/${ulid}`)
}

export const updateCalendarSource = (ulid: string, data: UpdateCalendarSourceDto): Promise<{ data: CalendarSource }> => {
  return api.patch(`/api/calendar-sources/${ulid}`, data)
}

export const deleteCalendarSource = (ulid: string): Promise<void> => {
  return api.delete(`/api/calendar-sources/${ulid}`)
}

// External Calendar Integration
export const getAuthorizationUrl = (type: 'google' | 'apple' | 'outlook'): Promise<{ data: AuthorizationResponse }> => {
  return api.get(`/api/external-calendar/auth/${type}`)
}

export const exchangeAuthCode = (type: 'google' | 'apple' | 'outlook', code: string, state: string): Promise<{ data: CalendarSource }> => {
  return api.post(`/api/external-calendar/callback/${type}`, { code, state })
}

export const syncCalendarSource = (calendarSourceUlid: string): Promise<{ data: SyncResult }> => {
  return api.post(`/api/external-calendar/sync/${calendarSourceUlid}`)
}

export const testCalendarConnection = (calendarSourceUlid: string): Promise<{ data: { success: boolean; message: string } }> => {
  return api.get(`/api/external-calendar/test/${calendarSourceUlid}`)
}

// Availability Checking
export const checkAvailability = (data: AvailabilityRequest): Promise<{ data: AvailabilityResponse }> => {
  return api.post('/api/availability/check', data)
}

export const findConflicts = (data: AvailabilityRequest): Promise<{ data: AvailabilityResponse }> => {
  return api.post('/api/availability/conflicts', data)
}

// External Events
export const getExternalEvents = (data: GetExternalEventsRequest): Promise<{ data: GetExternalEventsResponse }> => {
  return api.post('/api/external-calendar/events', data)
}
