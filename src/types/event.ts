import { CategoryEntity, FileEntity, Pagination } from './model'
import { MatrixMessage } from './matrix'
import { GroupEntity, GroupMemberEntity } from './group'
import { UserEntity } from './user'

export enum EventType {
  Online = 'online',
  InPerson = 'in-person',
  Hybrid = 'hybrid'
}

export enum EventAttendeePermission {
  DeleteEvent = 'DELETE_EVENT',
  CancelEvent = 'CANCEL_EVENT',
  ManageEvent = 'MANAGE_EVENT',
  ApproveAttendees = 'APPROVE_ATTENDEES',
  DeleteAttendees = 'DELETE_ATTENDEES',
  ManageAttendees = 'MANAGE_ATTENDEES',
  ManageDiscussions = 'MANAGE_DISCUSSIONS',
  ViewEvent = 'VIEW_EVENT',
  AttendEvent = 'ATTEND_EVENT',
  MessageAttendees = 'MESSAGE_ATTENDEES',
  CreateDiscussion = 'CREATE_DISCUSSION',
  ViewDiscussion = 'VIEW_DISCUSSION'
}

export enum EventVisibility {
  Public = 'public',
  Authenticated = 'authenticated',
  Private = 'private'
}
export enum EventStatus {
  Draft = 'draft',
  Pending = 'pending',
  Published = 'published',
  Cancelled = 'cancelled'
}
export enum EventAttendeeRole {
  Participant = 'participant',
  Host = 'host',
  Speaker = 'speaker',
  Moderator = 'moderator',
  Guest = 'guest'
}
export enum EventAttendeeStatus {
  Invited = 'invited',
  Confirmed = 'confirmed',
  Attended = 'attended',
  Cancelled = 'cancelled',
  Rejected = 'rejected',
  Maybe = 'maybe',
  Pending = 'pending',
  Waitlist = 'waitlist'
}

export interface EventAttendeePermissionEntity {
  id: number
  name: EventAttendeePermission
}

export interface EventAttendeeRoleEntity {
  id: number
  name: EventAttendeeRole
  permissions: EventAttendeePermissionEntity[]
}

interface EventCategory extends CategoryEntity {}

export interface EventAttendeeEntity {
  id: number
  userId: number
  // eslint-disable-next-line no-use-before-define
  event: EventEntity
  user: UserEntity
  role: EventAttendeeRoleEntity
  status: EventAttendeeStatus
  approvalAnswer?: string
  createdAt?: string
}

export interface EventTopicCommentEntity {
  // id: number
  // content: string
  // user: UserEntity
  // topic?: string
}

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY'
  interval?: number
  count?: number
  until?: string
  bysecond?: number[]
  byminute?: number[]
  byhour?: number[]
  byday?: string[]
  bymonthday?: number[]
  byyearday?: number[]
  byweekno?: number[]
  bymonth?: number[]
  bysetpos?: number[]
  wkst?: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
}

export interface EventEntity {
  id: number
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  timeZone?: string
  type: EventType
  location?: string
  locationOnline?: string
  lat?: number
  lon?: number
  image?: FileEntity | string
  description?: string
  maxAttendees?: number
  attendees?: EventAttendeeEntity[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  visibility?: EventVisibility
  userId?: number
  user?: UserEntity
  status?: EventStatus
  requireApproval?: boolean
  approvalQuestion?: string
  allowWaitlist?: boolean
  requireGroupMembership?: boolean
  groupMember?: GroupMemberEntity
  attendee?: EventAttendeeEntity
  topics?: { name: string }[]
  messages?: MatrixMessage[]
  roomId?: string
  sourceType?: string
  sourceId?: string
  sourceUrl?: string
  lastSyncedAt?: string
  sourceData?: Record<string, unknown>

  // Recurrence fields
  isRecurring?: boolean
  recurrenceRule?: RecurrenceRule
  recurrenceExceptions?: string[]
  recurrenceUntil?: string
  recurrenceCount?: number
  parentEventId?: number
  isRecurrenceException?: boolean
  originalDate?: string
  recurrenceDescription?: string

  // RFC 5545/7986 additional fields
  securityClass?: string
  priority?: number
  blocksTime?: boolean
  isAllDay?: boolean
  resources?: string
  color?: string
  conferenceData?: Record<string, unknown>
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
export interface EventAttendeePaginationEntity extends Pagination<EventAttendeeEntity> {}
