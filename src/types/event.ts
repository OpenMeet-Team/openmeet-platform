import { CategoryEntity, FileEntity, Pagination } from './model'
import { MatrixMessage } from './matrix'
import { GroupEntity, GroupMemberEntity } from './group'
import { UserEntity } from './user'

// Forward declare necessary interfaces
interface EventCategory extends CategoryEntity {}

// ======= Enums =======
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
  Unlisted = 'unlisted',
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

// ======= Core Entities =======
export interface EventAttendeePermissionEntity {
  id: number
  name: EventAttendeePermission
}

export interface EventAttendeeRoleEntity {
  id: number
  name: EventAttendeeRole
  permissions: EventAttendeePermissionEntity[]
}

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY'
  interval?: number
  count?: number
  until?: string
  bysecond?: number[]
  byminute?: number[]
  byhour?: number[]
  byweekday?: string[]
  bymonthday?: number[]
  byyearday?: number[]
  byweekno?: number[]
  bymonth?: number[]
  bysetpos?: number[]
  wkst?: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
  timeZone?: string // Added to support timezone-aware recurrence
  _userExplicitSelection?: boolean; // Flag to indicate user's explicit day selection
}

export interface EventTopicCommentEntity {
  // id: number
  // content: string
  // user: UserEntity
  // topic?: string
}

// Define a minimal event reference to break circular dependencies
export interface EventReference {
  id: number;
  slug: string;
  name: string;
}

// Define interfaces using the reference type
export interface EventAttendeeEntity {
  id: number;
  userId: number;
  event?: EventReference; // Use reference to break circular dependency
  user: UserEntity;
  role: EventAttendeeRoleEntity;
  status: EventAttendeeStatus;
  approvalAnswer?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Forward declaration
export interface EventSeriesEntity {
  id: number;
  name: string;
  description?: string;
  slug: string;
  events?: EventReference[]; // Use reference to break circular dependency
  recurrenceRule: Record<string, unknown>;
  recurrenceExceptions?: string[];
  recurrenceDescription?: string;
  timeZone?: string;
  user?: UserEntity;
  templateEventSlug?: string;
  templateEvent?: EventReference; // Use reference to break circular dependency
  createdAt?: string;
  updatedAt?: string;
}

// Primary interface definition
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
  matrixRoomId?: string
  sourceType?: string
  sourceId?: string
  sourceUrl?: string
  lastSyncedAt?: string
  sourceData?: Record<string, unknown>

  // Series reference - replaces recurrence fields
  seriesId?: number
  seriesSlug?: string
  series?: EventSeriesEntity
  isRecurrenceException?: boolean
  originalDate?: string

  // Legacy recurrence fields - needed for backwards compatibility with components
  // These fields might be deprecated in the future as they're moved to EventSeriesEntity
  isRecurring?: boolean
  recurrenceRule?: RecurrenceRule
  recurrenceExceptions?: string[]
  recurrenceUntil?: string
  recurrenceCount?: number
  recurrenceDescription?: string

  // RFC 5545/7986 additional fields
  securityClass?: string
  priority?: number
  blocksTime?: boolean
  isAllDay?: boolean
  resources?: string
  color?: string
  conferenceData?: Record<string, unknown>

  // Timestamp fields
  createdAt?: string
  updatedAt?: string
}

// ======= Pagination Entities =======
export interface EventPaginationEntity extends Pagination<EventEntity> {}
export interface EventAttendeePaginationEntity extends Pagination<EventAttendeeEntity> {}

// ======= Dashboard Summary =======
export interface DashboardEventCounts {
  hostingUpcoming: number
  attendingUpcoming: number
  past: number
}

export interface DashboardSummaryEntity {
  counts: DashboardEventCounts
  hostingThisWeek: EventEntity[]
  hostingLater: EventEntity[]
  attendingSoon: EventEntity[]
}
